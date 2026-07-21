// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../src/factory/PrivateVaultFactory.sol";

contract PrivateVaultBaseForkTest is Test {
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function testBaseMainnetUsdcEndToEnd() public {
        if (block.chainid != 8453) return;

        IERC20Metadata usdc = IERC20Metadata(BASE_USDC);
        assertGt(BASE_USDC.code.length, 0);
        assertEq(usdc.decimals(), 6);
        assertEq(usdc.symbol(), "USDC");

        PrivateVaultFactory factory = new PrivateVaultFactory(BASE_USDC);
        assertEq(factory.stakeToken(), BASE_USDC);

        address alice = makeAddr("base-fork-alice");
        address bob = makeAddr("base-fork-bob");
        address[] memory invited = new address[](2);
        invited[0] = alice;
        invited[1] = bob;
        PrivateVaultFactory.PrivateVaultParams memory params = PrivateVaultFactory.PrivateVaultParams({
            claim: "Base fork settlement",
            description: "Official Base USDC",
            stakeToken: BASE_USDC,
            resolutionMode: PrivateVault.ResolutionMode.AUTOMATIC_MAJORITY,
            stakePeriod: 1 days,
            resolutionPeriod: 0,
            minStake: 1e6,
            allowedWallets: invited
        });
        PrivateVault vault = PrivateVault(factory.createPrivateVault(params));
        assertEq(address(vault.stakeToken()), BASE_USDC);

        deal(BASE_USDC, alice, 3e6, true);
        deal(BASE_USDC, bob, 2e6, true);
        vm.startPrank(alice);
        usdc.approve(address(vault), 3e6);
        vault.stake(PrivateVault.Side.YES, 3e6);
        vm.stopPrank();
        vm.startPrank(bob);
        usdc.approve(address(vault), 2e6);
        vault.stake(PrivateVault.Side.NO, 2e6);
        vm.stopPrank();

        vm.warp(vault.stakeEndTime());
        vault.finalizeByCoreRules();
        assertEq(uint256(vault.resolvedOutcome()), uint256(PrivateVault.Outcome.YES));
        assertEq(vault.settlementPool(), 5e6);

        vm.prank(bob);
        vault.withdraw();
        vm.prank(alice);
        vault.withdraw();
        assertEq(usdc.balanceOf(alice), 5e6);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }
}
