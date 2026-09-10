// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {RestorationDeed, IERC20} from "../src/RestorationDeed.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @notice Deploys RestorationDeed. On Arc Testnet (chain id 5042002, RPC
///         https://rpc.testnet.arc.io, explorer https://testnet.arcscan.app) set
///         USDC_ADDRESS to the ERC-20 USDC interface; when unset a MockUSDC is
///         deployed for local/anvil use.
///
///   forge script script/Deploy.s.sol --rpc-url $ARC_TESTNET_RPC_URL --broadcast --private-key $DEPLOYER_KEY
contract Deploy is Script {
    function run() external {
        address usdcAddr = vm.envOr("USDC_ADDRESS", address(0));
        vm.startBroadcast();
        if (usdcAddr == address(0)) {
            MockUSDC mock = new MockUSDC();
            usdcAddr = address(mock);
            console.log("MockUSDC deployed at", usdcAddr);
        }
        RestorationDeed deed = new RestorationDeed(IERC20(usdcAddr));
        console.log("RestorationDeed deployed at", address(deed));
        vm.stopBroadcast();
    }
}
