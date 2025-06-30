// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import {AccountSpammer} from "../src/AccountSpammer.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        
        AccountSpammer spammer = new AccountSpammer();
        
        vm.stopBroadcast();
    }
}