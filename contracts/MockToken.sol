// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockToken
/// @notice Simple ERC-20 used to demo EternaVault token inheritance flow.
contract MockToken is ERC20 {
    constructor() ERC20("EternaVault Mock Token", "EVMT") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
