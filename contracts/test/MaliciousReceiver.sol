// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EternaVault} from "../EternaVault.sol";

/// @notice Test-only malicious heir contract that attempts to reenter
///         EternaVault.distribute() during ETH receive.
contract MaliciousReceiver {
    EternaVault public vault;
    uint256 public vaultId;
    bool public targetSet;
    bool public reentrancyAttempted;
    bool public reentrancyBlocked;

    function setTarget(address _vault, uint256 _vaultId) external {
        vault = EternaVault(payable(_vault));
        vaultId = _vaultId;
        targetSet = true;
    }

    function initiateClaim() external {
        vault.initiateClaim(vaultId);
    }

    receive() external payable {
        if (targetSet && !reentrancyAttempted) {
            reentrancyAttempted = true;
            try vault.distribute(vaultId) {
                reentrancyBlocked = false;
            } catch {
                reentrancyBlocked = true;
            }
        }
    }
}
