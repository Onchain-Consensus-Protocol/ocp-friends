// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/factory/PrivateVaultFactory.sol";

/**
 *  @notice Deploys the independent PrivateVaultFactory without creating a Vault.
 */
contract DeployPrivateVaultFactoryScript is Script {
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external returns (PrivateVaultFactory factory) {
        uint256 expectedChainId = vm.envOr("EXPECTED_CHAIN_ID", uint256(84532));
        require(block.chainid == expectedChainId, "Unexpected deployment chain");
        address stakeToken = vm.envAddress("STAKE_TOKEN_ADDRESS");
        if (block.chainid == 8453) {
            require(stakeToken == BASE_USDC, "Wrong Base USDC");
        } else if (block.chainid == 84532) {
            require(stakeToken == BASE_SEPOLIA_USDC, "Wrong Base Sepolia USDC");
        } else {
            revert("Unsupported deployment chain");
        }

        // 由 Foundry 的加密 keystore 账户签名，避免把部署私钥放进仓库或 shell 环境变量。
        vm.startBroadcast();
        factory = new PrivateVaultFactory(stakeToken);
        vm.stopBroadcast();

        console.log("PrivateVaultFactory:", address(factory));
        console.log("Stake token:", factory.stakeToken());
        console.log("Maximum allowed wallets:", factory.MAX_ALLOWED_WALLETS());
        console.log("Private Vaults created: 0");
    }
}
