// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract AccountSpammer {
    function createAccounts(address[] calldata accounts) external payable {
        require(msg.value == accounts.length, "No value sent");

        for (uint256 i = 0; i < accounts.length; i++) {
            payable(accounts[i]).transfer(1);
        }
    }
}
