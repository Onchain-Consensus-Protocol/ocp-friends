// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/factory/PrivateVaultFactory.sol";

/**
 *  @notice Deploys the independent PrivateVaultFactory without creating a Vault.
 */
contract DeployPrivateVaultFactoryScript is Script {
    function run() external returns (PrivateVaultFactory factory) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        require(deployerPrivateKey != 0, "Invalid PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        factory = new PrivateVaultFactory();
        vm.stopBroadcast();

        console.log("PrivateVaultFactory:", address(factory));
        console.log("Maximum allowed wallets:", factory.MAX_ALLOWED_WALLETS());
        console.log("Private Vaults created: 0");
    }
}
