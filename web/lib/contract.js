import { ethers } from "ethers";

export const VAULT_ADDRESS =
  process.env.NEXT_PUBLIC_VAULT_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11155111);
export const CHAIN_ID_HEX = "0x" + CHAIN_ID.toString(16);

export const CHAIN_NAMES = {
  1: "Ethereum Mainnet",
  11155111: "Sepolia",
  31337: "Hardhat Local",
};
export const CHAIN_NAME = CHAIN_NAMES[CHAIN_ID] || `chainId ${CHAIN_ID}`;

export const VAULT_STATUS = {
  0: "Active",
  1: "ClaimPeriod",
  2: "Distributed",
  3: "Cancelled",
};

export const ETHERSCAN_BASE =
  CHAIN_ID === 11155111
    ? "https://sepolia.etherscan.io"
    : CHAIN_ID === 1
    ? "https://etherscan.io"
    : "";

export const VAULT_ABI = [
  // events
  "event VaultCreated(uint256 indexed vaultId, address indexed owner, uint256 pingInterval, uint256 claimGracePeriod, uint256 claimThreshold, uint256 heirCount, uint256 initialDeposit)",
  "event Pinged(uint256 indexed vaultId, address indexed owner, uint256 lastPing)",
  "event Deposited(uint256 indexed vaultId, address indexed from, address indexed token, uint256 amount)",
  "event ClaimInitiated(uint256 indexed vaultId, address indexed heir, uint256 claimsReceived)",
  "event Distributed(uint256 indexed vaultId, address indexed caller)",
  "event Cancelled(uint256 indexed vaultId, address indexed owner)",
  // writes
  "function createVault(address[] heirWallets, uint8[] percentages, uint256 pingInterval, uint256 claimGracePeriod, uint256 claimThreshold) payable returns (uint256)",
  "function depositETH(uint256 vaultId) payable",
  "function depositERC20(uint256 vaultId, address token, uint256 amount)",
  "function ping(uint256 vaultId)",
  "function cancel(uint256 vaultId)",
  "function initiateClaim(uint256 vaultId)",
  "function distribute(uint256 vaultId)",
  // views
  "function nextVaultId() view returns (uint256)",
  "function getVault(uint256 vaultId) view returns (address owner, uint256 lastPing, uint256 pingInterval, uint256 ethBalance, uint8 status, uint256 claimsReceived, uint256 claimThreshold)",
  "function getVaultExtras(uint256 vaultId) view returns (uint256 claimGracePeriod, uint256 distributionStartedAt, address[] tokens, uint256[] tokenBalances)",
  "function getHeirs(uint256 vaultId) view returns (tuple(address wallet, uint8 percentage, bool hasInitiated)[])",
  "function getVaultsByOwner(address owner) view returns (uint256[])",
  "function getVaultsByHeir(address heir) view returns (uint256[])",
  "function isExpired(uint256 vaultId) view returns (bool)",
  "function timeUntilExpiry(uint256 vaultId) view returns (uint256)",
];

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

export function getReadProvider() {
  if (typeof window === "undefined") return null;
  if (!window.ethereum) return null;
  return new ethers.BrowserProvider(window.ethereum);
}

export async function getReadVault() {
  const provider = getReadProvider();
  if (!provider) return null;
  return new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
}

export async function getWriteVault() {
  const provider = getReadProvider();
  if (!provider) throw new Error("MetaMask not available");
  const signer = await provider.getSigner();
  return new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
}

export async function getERC20(address, withSigner = false) {
  const provider = getReadProvider();
  if (!provider) throw new Error("MetaMask not available");
  if (withSigner) {
    const signer = await provider.getSigner();
    return new ethers.Contract(address, ERC20_ABI, signer);
  }
  return new ethers.Contract(address, ERC20_ABI, provider);
}

function chainAddParams() {
  if (CHAIN_ID === 11155111) {
    return {
      chainId: CHAIN_ID_HEX,
      chainName: "Sepolia",
      nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://rpc.sepolia.org"],
      blockExplorerUrls: ["https://sepolia.etherscan.io"],
    };
  }
  if (CHAIN_ID === 31337) {
    return {
      chainId: CHAIN_ID_HEX,
      chainName: "Hardhat Local",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: ["http://127.0.0.1:8545"],
      blockExplorerUrls: [],
    };
  }
  return null;
}

export async function ensureChain() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask not detected");
  }
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (current === CHAIN_ID_HEX) return true;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
    return true;
  } catch (err) {
    if (err && err.code === 4902) {
      const params = chainAddParams();
      if (!params) throw err;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [params],
      });
      return true;
    }
    throw err;
  }
}

// Backwards-compatible alias.
export const ensureSepolia = ensureChain;

export function txUrl(hash) {
  if (!ETHERSCAN_BASE || !hash) return "";
  return `${ETHERSCAN_BASE}/tx/${hash}`;
}

export function addressUrl(addr) {
  if (!ETHERSCAN_BASE || !addr) return "";
  return `${ETHERSCAN_BASE}/address/${addr}`;
}
