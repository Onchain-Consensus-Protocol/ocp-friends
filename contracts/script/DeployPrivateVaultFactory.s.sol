// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/factory/PrivateVaultFactory.sol";

/**
 *  @notice Deploys the independent PrivateVaultFactory without creating a Vault.
 */
contract DeployPrivateVaultFactoryScript is Script {
    function run() external returns (PrivateVaultFactory factory) {
        uint256 expectedChainId = vm.envOr("EXPECTED_CHAIN_ID", uint256(84532));
        require(block.chainid == expectedChainId, "Unexpected deployment chain");

        // 由 Foundry 的加密 keystore 账户签名，避免把部署私钥放进仓库或 shell 环境变量。
        vm.startBroadcast();
        factory = new PrivateVaultFactory();
        vm.stopBroadcast();

        console.log("PrivateVaultFactory:", address(factory));
        console.log("Maximum allowed wallets:", factory.MAX_ALLOWED_WALLETS());
        console.log("Private Vaults created: 0");
    }
}
