// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title EternaVault
/// @notice Trustless inheritance contract using a "dead man's switch" pattern.
/// @dev One contract hosts many independent vaults keyed by vaultId.
contract EternaVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------------
    uint256 public constant MIN_PING_INTERVAL = 60;          // 1 minute
    uint256 public constant MAX_PING_INTERVAL = 3650 days;   // ~10 years
    uint256 public constant MAX_GRACE_PERIOD = 365 days;     // 1 year
    uint8 public constant TOTAL_PERCENTAGE = 100;
    uint256 public constant MAX_HEIRS = 20;

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------
    struct Heir {
        address wallet;
        uint8 percentage;
        bool hasInitiated;
    }

    enum VaultStatus {
        Active,
        ClaimPeriod,
        Distributed,
        Cancelled
    }

    struct Vault {
        address owner;
        uint256 lastPing;
        uint256 pingInterval;
        uint256 claimGracePeriod;
        uint256 claimThreshold;
        uint256 claimsReceived;
        uint256 ethBalance;
        address[] erc20Tokens;
        mapping(address => uint256) erc20Balances;
        mapping(address => bool) tokenTracked;
        Heir[] heirs;
        mapping(address => uint256) heirIndexPlusOne; // 0 means not an heir
        VaultStatus status;
        uint256 distributionStartedAt;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------
    uint256 public nextVaultId;
    mapping(uint256 => Vault) private vaults;
    mapping(address => uint256[]) private vaultsByOwner;
    mapping(address => uint256[]) private vaultsByHeir;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------
    event VaultCreated(
        uint256 indexed vaultId,
        address indexed owner,
        uint256 pingInterval,
        uint256 claimGracePeriod,
        uint256 claimThreshold,
        uint256 heirCount,
        uint256 initialDeposit
    );
    event Pinged(uint256 indexed vaultId, address indexed owner, uint256 lastPing);
    event Deposited(uint256 indexed vaultId, address indexed from, address indexed token, uint256 amount);
    event ClaimInitiated(uint256 indexed vaultId, address indexed heir, uint256 claimsReceived);
    event Distributed(uint256 indexed vaultId, address indexed caller);
    event Cancelled(uint256 indexed vaultId, address indexed owner);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------
    error NotOwner();
    error NotHeir();
    error VaultNotFound();
    error InvalidStatus();
    error VaultExpired();
    error VaultNotExpired();
    error ArrayLengthMismatch();
    error PercentagesMustSumTo100();
    error DuplicateHeir();
    error ZeroAddressHeir();
    error HeirCannotBeOwner();
    error InvalidPingInterval();
    error InvalidGracePeriod();
    error InvalidThreshold();
    error TooManyHeirs();
    error AlreadyInitiated();
    error ThresholdNotMet();
    error GracePeriodNotElapsed();
    error ZeroAmount();
    error ETHTransferFailed();
    error CannotCancelDistributed();

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------
    modifier vaultExists(uint256 vaultId) {
        if (vaultId >= nextVaultId) revert VaultNotFound();
        _;
    }

    // ---------------------------------------------------------------------
    // External: vault lifecycle
    // ---------------------------------------------------------------------
    function createVault(
        address[] calldata heirWallets,
        uint8[] calldata percentages,
        uint256 pingInterval,
        uint256 claimGracePeriod,
        uint256 claimThreshold
    ) external payable returns (uint256 vaultId) {
        if (heirWallets.length != percentages.length) revert ArrayLengthMismatch();
        if (heirWallets.length == 0) revert InvalidThreshold();
        if (heirWallets.length > MAX_HEIRS) revert TooManyHeirs();
        if (pingInterval < MIN_PING_INTERVAL || pingInterval > MAX_PING_INTERVAL) revert InvalidPingInterval();
        if (claimGracePeriod > MAX_GRACE_PERIOD) revert InvalidGracePeriod();
        if (claimThreshold == 0 || claimThreshold > heirWallets.length) revert InvalidThreshold();

        vaultId = nextVaultId++;
        Vault storage v = vaults[vaultId];
        v.owner = msg.sender;
        v.lastPing = block.timestamp;
        v.pingInterval = pingInterval;
        v.claimGracePeriod = claimGracePeriod;
        v.claimThreshold = claimThreshold;
        v.status = VaultStatus.Active;

        uint256 sum;
        for (uint256 i = 0; i < heirWallets.length; i++) {
            address w = heirWallets[i];
            uint8 p = percentages[i];
            if (w == address(0)) revert ZeroAddressHeir();
            if (w == msg.sender) revert HeirCannotBeOwner();
            if (v.heirIndexPlusOne[w] != 0) revert DuplicateHeir();

            v.heirs.push(Heir({wallet: w, percentage: p, hasInitiated: false}));
            v.heirIndexPlusOne[w] = v.heirs.length;
            vaultsByHeir[w].push(vaultId);
            sum += p;
        }
        if (sum != TOTAL_PERCENTAGE) revert PercentagesMustSumTo100();

        if (msg.value > 0) {
            v.ethBalance = msg.value;
        }

        vaultsByOwner[msg.sender].push(vaultId);

        emit VaultCreated(
            vaultId,
            msg.sender,
            pingInterval,
            claimGracePeriod,
            claimThreshold,
            heirWallets.length,
            msg.value
        );
    }

    function depositETH(uint256 vaultId) external payable nonReentrant vaultExists(vaultId) {
        if (msg.value == 0) revert ZeroAmount();
        Vault storage v = vaults[vaultId];
        if (v.status != VaultStatus.Active) revert InvalidStatus();
        v.ethBalance += msg.value;
        emit Deposited(vaultId, msg.sender, address(0), msg.value);
    }

    function depositERC20(uint256 vaultId, address token, uint256 amount)
        external
        nonReentrant
        vaultExists(vaultId)
    {
        if (amount == 0) revert ZeroAmount();
        Vault storage v = vaults[vaultId];
        if (v.status != VaultStatus.Active) revert InvalidStatus();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        if (!v.tokenTracked[token]) {
            v.tokenTracked[token] = true;
            v.erc20Tokens.push(token);
        }
        v.erc20Balances[token] += amount;
        emit Deposited(vaultId, msg.sender, token, amount);
    }

    function ping(uint256 vaultId) external vaultExists(vaultId) {
        Vault storage v = vaults[vaultId];
        if (msg.sender != v.owner) revert NotOwner();
        if (v.status != VaultStatus.Active) revert InvalidStatus();
        if (block.timestamp > v.lastPing + v.pingInterval) revert VaultExpired();

        v.lastPing = block.timestamp;
        emit Pinged(vaultId, msg.sender, block.timestamp);
    }

    function cancel(uint256 vaultId) external nonReentrant vaultExists(vaultId) {
        Vault storage v = vaults[vaultId];
        if (msg.sender != v.owner) revert NotOwner();
        if (v.status == VaultStatus.Distributed) revert CannotCancelDistributed();
        if (v.status == VaultStatus.Cancelled) revert InvalidStatus();

        v.status = VaultStatus.Cancelled;

        uint256 ethToReturn = v.ethBalance;
        v.ethBalance = 0;

        // Return tokens
        uint256 tokenCount = v.erc20Tokens.length;
        for (uint256 i = 0; i < tokenCount; i++) {
            address token = v.erc20Tokens[i];
            uint256 bal = v.erc20Balances[token];
            if (bal > 0) {
                v.erc20Balances[token] = 0;
                IERC20(token).safeTransfer(v.owner, bal);
            }
        }

        if (ethToReturn > 0) {
            (bool ok, ) = v.owner.call{value: ethToReturn}("");
            if (!ok) revert ETHTransferFailed();
        }

        emit Cancelled(vaultId, v.owner);
    }

    function initiateClaim(uint256 vaultId) external vaultExists(vaultId) {
        Vault storage v = vaults[vaultId];
        if (v.status != VaultStatus.Active && v.status != VaultStatus.ClaimPeriod) revert InvalidStatus();
        if (block.timestamp <= v.lastPing + v.pingInterval) revert VaultNotExpired();

        uint256 idxPlusOne = v.heirIndexPlusOne[msg.sender];
        if (idxPlusOne == 0) revert NotHeir();
        Heir storage h = v.heirs[idxPlusOne - 1];
        if (h.hasInitiated) revert AlreadyInitiated();

        h.hasInitiated = true;
        v.claimsReceived += 1;

        if (v.status == VaultStatus.Active && v.claimsReceived >= v.claimThreshold) {
            v.status = VaultStatus.ClaimPeriod;
            v.distributionStartedAt = block.timestamp;
        }

        emit ClaimInitiated(vaultId, msg.sender, v.claimsReceived);
    }

    function distribute(uint256 vaultId) external nonReentrant vaultExists(vaultId) {
        Vault storage v = vaults[vaultId];
        if (v.status != VaultStatus.ClaimPeriod) revert InvalidStatus();
        if (v.claimsReceived < v.claimThreshold) revert ThresholdNotMet();
        if (block.timestamp < v.distributionStartedAt + v.claimGracePeriod) revert GracePeriodNotElapsed();

        v.status = VaultStatus.Distributed;

        uint256 totalEth = v.ethBalance;
        v.ethBalance = 0;

        uint256 heirCount = v.heirs.length;
        uint256 distributedEth;

        // Pre-compute ETH shares; last heir gets dust.
        if (totalEth > 0) {
            for (uint256 i = 0; i < heirCount; i++) {
                Heir storage h = v.heirs[i];
                uint256 share;
                if (i == heirCount - 1) {
                    share = totalEth - distributedEth;
                } else {
                    share = (totalEth * h.percentage) / TOTAL_PERCENTAGE;
                    distributedEth += share;
                }
                if (share > 0) {
                    (bool ok, ) = h.wallet.call{value: share}("");
                    if (!ok) revert ETHTransferFailed();
                }
            }
        }

        // ERC-20s
        uint256 tokenCount = v.erc20Tokens.length;
        for (uint256 t = 0; t < tokenCount; t++) {
            address token = v.erc20Tokens[t];
            uint256 totalTok = v.erc20Balances[token];
            if (totalTok == 0) continue;
            v.erc20Balances[token] = 0;

            uint256 distributedTok;
            for (uint256 i = 0; i < heirCount; i++) {
                Heir storage h = v.heirs[i];
                uint256 share;
                if (i == heirCount - 1) {
                    share = totalTok - distributedTok;
                } else {
                    share = (totalTok * h.percentage) / TOTAL_PERCENTAGE;
                    distributedTok += share;
                }
                if (share > 0) {
                    IERC20(token).safeTransfer(h.wallet, share);
                }
            }
        }

        emit Distributed(vaultId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------
    function getVault(uint256 vaultId)
        external
        view
        vaultExists(vaultId)
        returns (
            address owner,
            uint256 lastPing,
            uint256 pingInterval,
            uint256 ethBalance,
            VaultStatus status,
            uint256 claimsReceived,
            uint256 claimThreshold
        )
    {
        Vault storage v = vaults[vaultId];
        return (
            v.owner,
            v.lastPing,
            v.pingInterval,
            v.ethBalance,
            v.status,
            v.claimsReceived,
            v.claimThreshold
        );
    }

    function getVaultExtras(uint256 vaultId)
        external
        view
        vaultExists(vaultId)
        returns (
            uint256 claimGracePeriod,
            uint256 distributionStartedAt,
            address[] memory tokens,
            uint256[] memory tokenBalances
        )
    {
        Vault storage v = vaults[vaultId];
        uint256 n = v.erc20Tokens.length;
        uint256[] memory bals = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            bals[i] = v.erc20Balances[v.erc20Tokens[i]];
        }
        return (v.claimGracePeriod, v.distributionStartedAt, v.erc20Tokens, bals);
    }

    function getHeirs(uint256 vaultId)
        external
        view
        vaultExists(vaultId)
        returns (Heir[] memory)
    {
        Vault storage v = vaults[vaultId];
        uint256 n = v.heirs.length;
        Heir[] memory out = new Heir[](n);
        for (uint256 i = 0; i < n; i++) {
            out[i] = v.heirs[i];
        }
        return out;
    }

    function getVaultsByOwner(address owner) external view returns (uint256[] memory) {
        return vaultsByOwner[owner];
    }

    function getVaultsByHeir(address heir) external view returns (uint256[] memory) {
        return vaultsByHeir[heir];
    }

    function isExpired(uint256 vaultId) external view vaultExists(vaultId) returns (bool) {
        Vault storage v = vaults[vaultId];
        return block.timestamp > v.lastPing + v.pingInterval;
    }

    function timeUntilExpiry(uint256 vaultId) external view vaultExists(vaultId) returns (uint256) {
        Vault storage v = vaults[vaultId];
        uint256 deadline = v.lastPing + v.pingInterval;
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

    // Allow direct ETH receive only via depositETH/createVault
    receive() external payable {
        revert("Use depositETH or createVault");
    }
}
