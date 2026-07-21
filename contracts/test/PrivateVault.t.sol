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

contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0)) {
            super._update(from, address(0), 1);
            super._update(from, to, amount - 1);
        } else {
            super._update(from, to, amount);
        }
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
        token = new TestUSDC();
        factory = new PrivateVaultFactory(address(token));
        token.mint(creator, 1_000 * UNIT);
        token.mint(alice, 1_000 * UNIT);
        token.mint(bob, 1_000 * UNIT);
        token.mint(outsider, 1_000 * UNIT);
    }

    function testFactoryBindsSingleStakeToken() public {
        assertEq(factory.stakeToken(), address(token));
        TestUSDC otherToken = new TestUSDC();
        address[] memory invited = new address[](1);
        invited[0] = alice;
        PrivateVaultFactory.PrivateVaultParams memory params = PrivateVaultFactory.PrivateVaultParams({
            claim: "Wrong token",
            description: "Must revert",
            stakeToken: address(otherToken),
            resolutionMode: PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY,
            stakePeriod: 1 days,
            resolutionPeriod: 0,
            minStake: UNIT,
            allowedWallets: invited
        });
        vm.prank(creator);
        vm.expectRevert("Unsupported stake token");
        factory.createPrivateVault(params);
    }

    function testFactoryRejectsInvalidBoundToken() public {
        vm.expectRevert("Invalid token");
        new PrivateVaultFactory(address(0));
        vm.expectRevert("Token has no code");
        new PrivateVaultFactory(alice);
    }

    function testFuzzSettlementConservesAllPrincipal(
        uint96 yesASeed,
        uint96 yesBSeed,
        uint96 noSeed
    ) public {
        uint256 yesA = bound(uint256(yesASeed), UNIT, 100 * UNIT);
        uint256 yesB = bound(uint256(yesBSeed), UNIT, 100 * UNIT);
        uint256 noAmount = bound(uint256(noSeed), UNIT, 100 * UNIT);
        PrivateVault vault = _create(PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0);
        _stake(creator, vault, PrivateVault.Side.YES, yesA);
        _stake(alice, vault, PrivateVault.Side.YES, yesB);
        _stake(bob, vault, PrivateVault.Side.NO, noAmount);

        vm.warp(vault.stakeEndTime());
        vault.finalizeByCoreRules();
        assertEq(vault.totalPrincipal(), yesA + yesB + noAmount);
        assertEq(vault.totalStakeYes() + vault.totalStakeNo(), vault.totalPrincipal());
        assertEq(vault.settlementPool(), vault.totalPrincipal());

        uint256 beforeTotal =
            token.balanceOf(creator) + token.balanceOf(alice) + token.balanceOf(bob);
        vm.prank(bob);
        vault.withdraw();
        vm.prank(creator);
        vault.withdraw();
        vm.prank(alice);
        vault.withdraw();
        uint256 afterTotal =
            token.balanceOf(creator) + token.balanceOf(alice) + token.balanceOf(bob);
        assertEq(afterTotal - beforeTotal, yesA + yesB + noAmount);
        assertEq(token.balanceOf(address(vault)), 0);
    }

    function testFactoryStoresMetadataAndWhitelist() public {
        PrivateVault vault = _create(PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0);
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
        PrivateVault vault = _create(PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0);
        _approve(outsider, vault);
        vm.prank(outsider);
        vm.expectRevert("Wallet not invited");
        vault.stake(PrivateVault.Side.YES, 10 * UNIT);
    }

    function testCoreRulesPaysWinningSideProRata() public {
        PrivateVault vault = _create(PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0);
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

    function testAutomaticMajorityExactBoundaries() public {
        PrivateVault yesVault = _create(PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0);
        _stake(alice, yesVault, PrivateVault.Side.YES, 51 * UNIT);
        _stake(bob, yesVault, PrivateVault.Side.NO, 49 * UNIT);
        vm.warp(yesVault.stakeEndTime());
        yesVault.finalizeByCoreRules();
        assertEq(uint256(yesVault.resolvedOutcome()), uint256(PrivateVault.Outcome.YES));

        PrivateVault noVault = _create(PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0);
        _stake(alice, noVault, PrivateVault.Side.YES, 49 * UNIT);
        _stake(bob, noVault, PrivateVault.Side.NO, 51 * UNIT);
        vm.warp(noVault.stakeEndTime());
        noVault.finalizeByCoreRules();
        assertEq(uint256(noVault.resolvedOutcome()), uint256(PrivateVault.Outcome.NO));

        PrivateVault tieVault = _create(PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0);
        _stake(alice, tieVault, PrivateVault.Side.YES, 50 * UNIT);
        _stake(bob, tieVault, PrivateVault.Side.NO, 50 * UNIT);
        vm.warp(tieVault.stakeEndTime());
        tieVault.finalizeByCoreRules();
        assertEq(uint256(tieVault.resolvedOutcome()), uint256(PrivateVault.Outcome.INVALID));
    }

    function testInvalidRefundsEveryoneInFull() public {
        PrivateVault vault = _create(PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0);
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
        PrivateVault coreVault = _create(PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0);
        vm.warp(coreVault.stakeEndTime());
        coreVault.finalizeByCoreRules();
        assertEq(uint256(coreVault.resolvedOutcome()), uint256(PrivateVault.Outcome.INVALID));

        PrivateVault creatorVault = _create(PrivateVault.ResolutionMode.CREATOR_RESOLVED, 1 days);
        vm.warp(creatorVault.stakeEndTime());
        vm.prank(creator);
        vm.expectRevert("No YES stake");
        creatorVault.resolveByCreator(PrivateVault.Outcome.YES);
        vm.prank(creator);
        creatorVault.resolveByCreator(PrivateVault.Outcome.INVALID);
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

    function testCreatorCannotSelectEmptyWinningSide() public {
        PrivateVault vault = _create(PrivateVault.ResolutionMode.CREATOR_RESOLVED, 1 days);
        _stake(alice, vault, PrivateVault.Side.NO, 15 * UNIT);

        vm.warp(vault.stakeEndTime());
        vm.prank(creator);
        vm.expectRevert("No YES stake");
        vault.resolveByCreator(PrivateVault.Outcome.YES);

        PrivateVault yesOnlyVault = _create(PrivateVault.ResolutionMode.CREATOR_RESOLVED, 1 days);
        _stake(alice, yesOnlyVault, PrivateVault.Side.YES, 15 * UNIT);
        vm.warp(yesOnlyVault.stakeEndTime());
        vm.prank(creator);
        vm.expectRevert("No NO stake");
        yesOnlyVault.resolveByCreator(PrivateVault.Outcome.NO);

        assertFalse(vault.finalized());
        vm.prank(creator);
        vault.resolveByCreator(PrivateVault.Outcome.NO);
        assertEq(uint256(vault.resolvedOutcome()), uint256(PrivateVault.Outcome.NO));
    }

    function testCreatorInvalidRefundsYesAndNo() public {
        PrivateVault vault = _create(PrivateVault.ResolutionMode.CREATOR_RESOLVED, 1 days);
        _stake(alice, vault, PrivateVault.Side.YES, 9 * UNIT);
        _stake(bob, vault, PrivateVault.Side.NO, 11 * UNIT);

        vm.warp(vault.stakeEndTime());
        vm.prank(creator);
        vault.resolveByCreator(PrivateVault.Outcome.INVALID);

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        vault.withdraw();
        assertEq(token.balanceOf(alice) - aliceBefore, 9 * UNIT);

        uint256 bobBefore = token.balanceOf(bob);
        vm.prank(bob);
        vault.withdraw();
        assertEq(token.balanceOf(bob) - bobBefore, 11 * UNIT);
    }

    function testInvalidIsNotAStakeableSide() public {
        PrivateVault vault = _create(PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0);
        _approve(alice, vault);
        vm.prank(alice);
        (bool ok,) = address(vault)
            .call(abi.encodeWithSignature("stake(uint8,uint256)", uint8(2), 10 * UNIT));
        assertFalse(ok);
        assertEq(vault.totalPrincipal(), 0);
        assertEq(vault.totalStakeInvalid(), 0);
        (uint256 yes, uint256 no, uint256 invalidAmount) = vault.stakeOf(alice);
        assertEq(yes, 0);
        assertEq(no, 0);
        assertEq(invalidAmount, 0);
        assertEq(vault.protocolVersion(), 2);
        assertEq(vault.totalPrincipal(), vault.totalStakeYes() + vault.totalStakeNo());
    }

    function testExpiredCreatorResolutionRefundsPrincipal() public {
        PrivateVault vault = _create(PrivateVault.ResolutionMode.CREATOR_RESOLVED, 1 days);
        _stake(alice, vault, PrivateVault.Side.YES, 6 * UNIT);
        _stake(bob, vault, PrivateVault.Side.NO, 4 * UNIT);
        vm.warp(vault.resolutionDeadline() + 1);
        vault.finalizeExpiredResolution();

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        vault.withdraw();
        assertEq(token.balanceOf(alice) - aliceBefore, 6 * UNIT);

        uint256 bobBefore = token.balanceOf(bob);
        vm.prank(bob);
        vault.withdraw();
        assertEq(token.balanceOf(bob) - bobBefore, 4 * UNIT);
    }

    function testRejectsFeeOnTransferStakeWithoutChangingAccounting() public {
        FeeOnTransferToken feeToken = new FeeOnTransferToken();
        factory = new PrivateVaultFactory(address(feeToken));
        feeToken.mint(alice, 100 * UNIT);
        address[] memory invited = new address[](1);
        invited[0] = alice;
        PrivateVault vault = _createWithToken(
            address(feeToken), PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0, invited
        );

        vm.prank(alice);
        feeToken.approve(address(vault), type(uint256).max);
        vm.prank(alice);
        vm.expectRevert("Unsupported token transfer");
        vault.stake(PrivateVault.Side.YES, 10 * UNIT);

        assertEq(vault.totalPrincipal(), 0);
        assertEq(vault.totalStakeYes(), 0);
        assertFalse(vault.hasParticipated(alice));
        assertEq(feeToken.balanceOf(address(vault)), 0);
    }

    function testLastClaimantReceivesTransfersAfterFinalization() public {
        PrivateVault vault = _create(PrivateVault.ResolutionMode.CREATOR_RESOLVED, 1 days);
        _stake(alice, vault, PrivateVault.Side.YES, 1 * UNIT);
        _stake(bob, vault, PrivateVault.Side.YES, 2 * UNIT);
        _stake(creator, vault, PrivateVault.Side.NO, 7 * UNIT);

        vm.warp(vault.stakeEndTime());
        vm.prank(creator);
        vault.resolveByCreator(PrivateVault.Outcome.YES);
        assertEq(vault.settlementPool(), 10 * UNIT);

        vm.prank(creator);
        vault.withdraw();
        assertEq(vault.remainingEligibleClaims(), 2);

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        vault.withdraw();
        assertEq(token.balanceOf(alice) - aliceBefore, 10 * UNIT / 3);

        vm.prank(outsider);
        token.transfer(address(vault), 5 * UNIT);

        uint256 bobBefore = token.balanceOf(bob);
        vm.prank(bob);
        vault.withdraw();
        assertEq(token.balanceOf(bob) - bobBefore, 15 * UNIT - (10 * UNIT / 3));
        assertEq(token.balanceOf(address(vault)), 0);

        vm.prank(outsider);
        token.transfer(address(vault), UNIT);
        assertEq(token.balanceOf(address(vault)), UNIT);
    }

    function testFinalizationTransferFollowsLastClaimOrder() public {
        PrivateVault vault = _create(PrivateVault.ResolutionMode.CREATOR_RESOLVED, 1 days);
        _stake(alice, vault, PrivateVault.Side.YES, 1 * UNIT);
        _stake(bob, vault, PrivateVault.Side.YES, 2 * UNIT);
        _stake(creator, vault, PrivateVault.Side.NO, 7 * UNIT);

        vm.warp(vault.stakeEndTime());
        vm.prank(creator);
        vault.resolveByCreator(PrivateVault.Outcome.YES);

        uint256 bobBefore = token.balanceOf(bob);
        vm.prank(bob);
        vault.withdraw();
        assertEq(token.balanceOf(bob) - bobBefore, 20 * UNIT / 3);

        vm.prank(outsider);
        token.transfer(address(vault), 5 * UNIT);

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        vault.withdraw();
        assertEq(token.balanceOf(alice) - aliceBefore, 15 * UNIT - (20 * UNIT / 3));
        assertEq(token.balanceOf(address(vault)), 0);
    }

    function testRemovingAllowedWalletReleasesCapacity() public {
        address[] memory invited = new address[](99);
        for (uint256 i; i < invited.length; ++i) {
            invited[i] = address(uint160(10_000 + i));
        }
        PrivateVault vault = _createWithToken(
            address(token), PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0, invited
        );
        assertEq(vault.allowedWalletCount(), 100);

        vm.prank(creator);
        vault.removeAllowedWallet(invited[0]);
        assertEq(vault.allowedWalletCount(), 99);

        address replacement = address(uint160(20_000));
        address[] memory addition = new address[](1);
        addition[0] = replacement;
        vm.prank(creator);
        vault.addAllowedWallets(addition);
        assertTrue(vault.allowedWallets(replacement));
        assertEq(vault.allowedWalletCount(), 100);
    }

    function testCanResolveViewsFollowAvailableSettlementPath() public {
        PrivateVault coreVault = _create(PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0);
        assertFalse(coreVault.canResolve());
        vm.warp(coreVault.stakeEndTime());
        assertTrue(coreVault.canResolve());
        coreVault.finalizeByCoreRules();
        assertFalse(coreVault.canResolve());

        PrivateVault creatorVault = _create(PrivateVault.ResolutionMode.CREATOR_RESOLVED, 1 days);
        vm.warp(creatorVault.stakeEndTime());
        assertTrue(creatorVault.canResolve());
        assertTrue(creatorVault.canResolveByCreator(creator));
        assertFalse(creatorVault.canResolveByCreator(alice));
        vm.warp(creatorVault.resolutionDeadline() + 1);
        assertTrue(creatorVault.canResolve());
        assertFalse(creatorVault.canResolveByCreator(creator));
        assertTrue(creatorVault.canFinalizeExpiredResolution());
        creatorVault.finalizeExpiredResolution();
        assertFalse(creatorVault.canResolve());
        assertFalse(creatorVault.canFinalizeExpiredResolution());
    }

    function testFactoryPagination() public {
        PrivateVault first = _create(PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0);
        PrivateVault second = _create(PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0);
        PrivateVault third = _create(PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0);

        assertEq(factory.privateVaultCount(), 3);
        address[] memory page = factory.getPrivateVaults(1, 2);
        assertEq(page.length, 2);
        assertEq(page[0], address(second));
        assertEq(page[1], address(third));
        assertEq(factory.getPrivateVaults(3, 2).length, 0);

        assertEq(factory.creatorPrivateVaultCount(creator), 3);
        address[] memory creatorPage = factory.getCreatorPrivateVaults(creator, 0, 2);
        assertEq(creatorPage.length, 2);
        assertEq(creatorPage[0], address(first));
        assertEq(creatorPage[1], address(second));

        vm.expectRevert("Invalid page size");
        factory.getPrivateVaults(0, 0);
        vm.expectRevert("Invalid page size");
        factory.getPrivateVaults(0, 101);
    }

    function testNoDonationEntryPoint() public {
        PrivateVault vault = _create(PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY, 0);
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
        vault = _createWithToken(address(token), mode, resolutionPeriod, invited);
    }

    function _createWithToken(
        address tokenAddress,
        PrivateVault.ResolutionMode mode,
        uint256 resolutionPeriod,
        address[] memory invited
    ) private returns (PrivateVault vault) {
        PrivateVaultFactory.PrivateVaultParams memory params =
            PrivateVaultFactory.PrivateVaultParams({
                claim: "Will the team ship?",
                description: "A private claim party",
                stakeToken: tokenAddress,
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

    function _stake(address user, PrivateVault vault, PrivateVault.Side side, uint256 amount)
        private
    {
        _approve(user, vault);
        vm.prank(user);
        vault.stake(side, amount);
    }
}
