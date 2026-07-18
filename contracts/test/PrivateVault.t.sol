// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../src/factory/PrivateVaultFactory.sol";

contract TestUSDC is ERC20 {
    constructor() ERC20("Test USDC", "USDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PrivateVaultTest is Test {
    PrivateVaultFactory private factory;
    TestUSDC private token;

    address private creator = makeAddr("creator");
    address private alice = makeAddr("alice");
    address private bob = makeAddr("bob");
    address private outsider = makeAddr("outsider");

    uint256 private constant UNIT = 1e18;

    function setUp() public {
        factory = new PrivateVaultFactory();
        token = new TestUSDC();
        token.mint(creator, 1_000 * UNIT);
        token.mint(alice, 1_000 * UNIT);
        token.mint(bob, 1_000 * UNIT);
        token.mint(outsider, 1_000 * UNIT);
    }

    function testFactoryStoresMetadataAndWhitelist() public {
        PrivateVault vault = _create(PrivateVault.ResolutionMode.CORE_RULES, 0);
        (string memory claim, string memory description) =
            factory.getPrivateVaultMeta(address(vault));

        assertEq(claim, "Will the team ship?");
        assertEq(description, "A private claim party");
        assertTrue(vault.allowedWallets(creator));
        assertTrue(vault.allowedWallets(alice));
        assertTrue(vault.allowedWallets(bob));
        assertFalse(vault.allowedWallets(outsider));
    }

    function testOutsiderCannotStake() public {
        PrivateVault vault = _create(PrivateVault.ResolutionMode.CORE_RULES, 0);
        _approve(outsider, vault);
        vm.prank(outsider);
        vm.expectRevert("Wallet not invited");
        vault.stake(PrivateVault.Side.YES, 10 * UNIT);
    }

    function testCoreRulesPaysWinningSideProRata() public {
        PrivateVault vault = _create(PrivateVault.ResolutionMode.CORE_RULES, 0);
        _stake(creator, vault, PrivateVault.Side.YES, 60 * UNIT);
        _stake(alice, vault, PrivateVault.Side.YES, 20 * UNIT);
        _stake(bob, vault, PrivateVault.Side.NO, 20 * UNIT);

        vm.warp(vault.stakeEndTime());
        vault.finalizeByCoreRules();
        assertEq(uint256(vault.resolvedOutcome()), uint256(PrivateVault.Outcome.YES));

        uint256 beforeCreator = token.balanceOf(creator);
        vm.prank(creator);
        vault.withdraw();
        assertEq(token.balanceOf(creator) - beforeCreator, 75 * UNIT);

        uint256 beforeAlice = token.balanceOf(alice);
        vm.prank(alice);
        vault.withdraw();
        assertEq(token.balanceOf(alice) - beforeAlice, 25 * UNIT);

        uint256 beforeBob = token.balanceOf(bob);
        vm.prank(bob);
        vault.withdraw();
        assertEq(token.balanceOf(bob), beforeBob);
    }

    function testInvalidRefundsEveryoneInFull() public {
        PrivateVault vault = _create(PrivateVault.ResolutionMode.CORE_RULES, 0);
        _stake(alice, vault, PrivateVault.Side.YES, 40 * UNIT);
        _stake(bob, vault, PrivateVault.Side.NO, 40 * UNIT);

        vm.warp(vault.stakeEndTime());
        vault.finalizeByCoreRules();
        assertEq(uint256(vault.resolvedOutcome()), uint256(PrivateVault.Outcome.INVALID));

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        vault.withdraw();
        assertEq(token.balanceOf(alice) - aliceBefore, 40 * UNIT);

        uint256 bobBefore = token.balanceOf(bob);
        vm.prank(bob);
        vault.withdraw();
        assertEq(token.balanceOf(bob) - bobBefore, 40 * UNIT);
    }

    function testEmptyVaultAlwaysFinalizesInvalid() public {
        PrivateVault coreVault = _create(PrivateVault.ResolutionMode.CORE_RULES, 0);
        vm.warp(coreVault.stakeEndTime());
        coreVault.finalizeByCoreRules();
        assertEq(uint256(coreVault.resolvedOutcome()), uint256(PrivateVault.Outcome.INVALID));

        PrivateVault creatorVault = _create(PrivateVault.ResolutionMode.CREATOR_RESOLVED, 1 days);
        vm.warp(creatorVault.stakeEndTime());
        vm.prank(creator);
        creatorVault.resolveByCreator(PrivateVault.Outcome.YES);
        assertEq(uint256(creatorVault.resolvedOutcome()), uint256(PrivateVault.Outcome.INVALID));
    }

    function testCreatorResolutionAndExpiredFallback() public {
        PrivateVault resolvedVault = _create(PrivateVault.ResolutionMode.CREATOR_RESOLVED, 1 days);
        _stake(alice, resolvedVault, PrivateVault.Side.NO, 15 * UNIT);
        vm.warp(resolvedVault.stakeEndTime());
        vm.prank(creator);
        resolvedVault.resolveByCreator(PrivateVault.Outcome.NO);
        assertEq(uint256(resolvedVault.resolvedOutcome()), uint256(PrivateVault.Outcome.NO));

        PrivateVault expiredVault = _create(PrivateVault.ResolutionMode.CREATOR_RESOLVED, 1 days);
        _stake(bob, expiredVault, PrivateVault.Side.YES, 15 * UNIT);
        vm.warp(expiredVault.resolutionDeadline() + 1);
        expiredVault.finalizeExpiredResolution();
        assertEq(uint256(expiredVault.resolvedOutcome()), uint256(PrivateVault.Outcome.INVALID));
    }

    function testNoDonationEntryPoint() public {
        PrivateVault vault = _create(PrivateVault.ResolutionMode.CORE_RULES, 0);
        (bool ok,) = address(vault).call(abi.encodeWithSignature("donate(uint256)", UNIT));
        assertFalse(ok);
    }

    function _create(PrivateVault.ResolutionMode mode, uint256 resolutionPeriod)
        private
        returns (PrivateVault vault)
    {
        address[] memory invited = new address[](2);
        invited[0] = alice;
        invited[1] = bob;
        PrivateVaultFactory.PrivateVaultParams memory params = PrivateVaultFactory.PrivateVaultParams({
            claim: "Will the team ship?",
            description: "A private claim party",
            stakeToken: address(token),
            resolutionMode: mode,
            stakePeriod: 1 days,
            resolutionPeriod: resolutionPeriod,
            minStake: UNIT,
            allowedWallets: invited
        });
        vm.prank(creator);
        vault = PrivateVault(factory.createPrivateVault(params));
    }

    function _approve(address user, PrivateVault vault) private {
        vm.prank(user);
        token.approve(address(vault), type(uint256).max);
    }

    function _stake(
        address user,
        PrivateVault vault,
        PrivateVault.Side side,
        uint256 amount
    ) private {
        _approve(user, vault);
        vm.prank(user);
        vault.stake(side, amount);
    }
}
