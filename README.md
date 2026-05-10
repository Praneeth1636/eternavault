# EternaVault

> **Trustless inheritance for the digital age.**

When a crypto holder dies, their funds are typically lost forever — heirs don't have
the seed phrase, and exchanges and custodians have inconsistent (often non-existent)
inheritance pathways. EternaVault solves this on-chain: a "dead-man's switch" smart
contract that requires the owner to periodically *ping* it. If the pings stop, the
designated heirs can claim and distribute the locked ETH and ERC-20 tokens according
to pre-set percentages — without lawyers, custodians, or seed-phrase escrow.

---

## ✨ Features

- **Dead-man's switch.** Owner sets a ping interval; missing it triggers the claim window.
- **Multi-heir threshold.** Require N-of-M heirs to initiate a claim before the grace period starts.
- **Configurable grace period.** A cooling-off window during which the owner can still cancel.
- **Cancel anytime.** While Active or in the Claim Period, the owner can pull all funds back.
- **ETH + arbitrary ERC-20s.** Each asset is split proportionally on distribution.
- **Dust handling.** Rounding remainders go to the last heir — every wei is accounted for.
- **Multi-vault.** A single contract hosts independent vaults for any number of users.
- **Custom errors + ReentrancyGuard.** Gas-efficient and reentrancy-safe.
- **Permissionless distribution.** Once the threshold and grace period are satisfied, anyone can call `distribute()`.

---

## 🧱 Tech stack

| Layer            | Choice                                                     |
|------------------|------------------------------------------------------------|
| Smart contracts  | Solidity ^0.8.20, OpenZeppelin v5                          |
| Toolchain        | Hardhat (JavaScript), ethers v6, hardhat-toolbox           |
| Tests            | Mocha + Chai + `@nomicfoundation/hardhat-network-helpers`  |
| Frontend         | Next.js 14 (App Router), React 18, ethers v6, CSS Modules |
| Wallet           | MetaMask via `window.ethereum` (no Web3Modal)              |
| Network          | Sepolia testnet (chainId 11155111) + local Hardhat node    |
| RPC              | Alchemy (URL via `.env`)                                   |

---

## 🌐 Live contract address

> _Replace this placeholder with the real address after running `scripts/deploy.js` against Sepolia._

```
EternaVault: 0x____________________________________________
```

---

## 📂 Project layout

```
eternavault/
├── contracts/
│   ├── EternaVault.sol           # Inheritance contract
│   ├── MockToken.sol             # Demo ERC-20
│   └── test/
│       └── MaliciousReceiver.sol # Reentrancy test helper
├── scripts/
│   ├── deploy.js                 # Deploy + verify EternaVault
│   └── deployMock.js             # Deploy MockToken
├── test/
│   └── EternaVault.test.js       # 34 test cases
├── web/
│   ├── app/                      # Next.js 14 App Router
│   │   ├── layout.js
│   │   ├── page.js               # /
│   │   ├── create/page.js        # /create
│   │   ├── my-vault/page.js      # /my-vault
│   │   ├── heir/page.js          # /heir
│   │   └── claim/[vaultId]/page.js
│   ├── components/
│   │   ├── ConnectWallet.js
│   │   ├── TxModal.js
│   │   ├── StatusBadge.js
│   │   ├── CountdownTimer.js
│   │   └── HeirList.js
│   ├── lib/
│   │   ├── contract.js           # ABI, addresses, ethers wrappers
│   │   └── format.js             # ETH/token/duration formatters
│   ├── styles/                   # (CSS modules colocated next to components)
│   └── package.json
├── hardhat.config.js
├── package.json
├── .env.example
├── .gitignore
├── README.md
└── LICENSE
```

---

## 🚀 Setup

### 1. Prerequisites

- Node.js v20 or higher
- A Sepolia-funded MetaMask account (use a **fresh** wallet — never your main one)
- An [Alchemy](https://www.alchemy.com/) Sepolia app for the RPC URL
- An [Etherscan API key](https://etherscan.io/myapikey) (optional, for auto-verification)

### 2. Install dependencies

```bash
# Root (Hardhat)
npm install

# Frontend
cd web && npm install && cd ..
```

### 3. Configure environment

```bash
cp .env.example .env
# edit .env and fill in:
#   SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY
```

The `PRIVATE_KEY` is a 64-character hex string with **no `0x` prefix**.

> ⚠️ Never commit your `.env`. The `.gitignore` already excludes it.

---

## 🧪 Compile & test

```bash
npx hardhat compile
npx hardhat test
```

All 34 test cases should pass:

```
  EternaVault
    createVault
      ✔ creates a vault with valid inputs and emits VaultCreated
      ✔ reverts when percentages do not sum to 100
      ... 32 more ✔
  34 passing
```

---

## 🌍 Deploy

### Local Hardhat node

```bash
# terminal 1
npx hardhat node

# terminal 2
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/deployMock.js --network localhost   # optional
```

### Sepolia testnet

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

The script prints a copy-paste block for `web/.env.local`:

```
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=11155111
```

If `ETHERSCAN_API_KEY` is set, the contract is verified on Sepolia Etherscan automatically.

For the demo ERC-20 (used to demonstrate token inheritance):

```bash
npx hardhat run scripts/deployMock.js --network sepolia
```

---

## 🖥 Run the frontend

```bash
cd web
cp .env.example .env.local
# edit .env.local with the deployed contract address
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app auto-detects MetaMask, prompts a switch to Sepolia if needed, and reacts to
`accountsChanged` / `chainChanged` events.

---

## 🎬 End-to-end demo flow

To demo in under 5 minutes, set `pingInterval = 60s` and `gracePeriod = 60s` (use the
"1 min (demo)" preset on the Create page).

1. **Connect** — open `/`, click _Connect Wallet_, switch to Sepolia.
2. **Create** — go to `/create`. Add 2 heirs (different test wallets), 50/50 split. Pick "1 min (demo)" for both ping interval and grace period. Threshold = 1. Initial deposit = 0.05 ETH. Submit. Wait for the green check.
3. **My Vaults** — `/my-vault` shows the new vault. The countdown starts ticking down from 60s. Click _Ping_ to reset it (you'll see the countdown jump back to 60s).
4. **Simulate death** — stop pinging. Wait 60+ seconds. The status badge flips to _Expired_.
5. **Heir initiates** — switch MetaMask to one of the heir accounts. Open `/heir`. Click _Initiate Claim_. The vault's status flips to _Claim Period_ once the threshold is hit, and the grace-period countdown begins.
6. **Wait** the grace period (60s for the demo).
7. **Distribute** — open `/claim/<vaultId>` (anyone can call this). Click _Distribute Now_. Funds split into the heir wallets according to percentage.
8. **Verify** — open the tx on [sepolia.etherscan.io](https://sepolia.etherscan.io). Confirm both heir balances ticked up by the right amounts.

---

## 📜 Smart contract surface

```solidity
// Lifecycle
function createVault(
    address[] calldata heirWallets,
    uint8[]   calldata percentages,
    uint256 pingInterval,
    uint256 claimGracePeriod,
    uint256 claimThreshold
) external payable returns (uint256 vaultId);

function depositETH(uint256 vaultId)                     external payable;
function depositERC20(uint256 vaultId, address token, uint256 amount) external;
function ping(uint256 vaultId)                           external;
function cancel(uint256 vaultId)                         external;
function initiateClaim(uint256 vaultId)                  external;
function distribute(uint256 vaultId)                     external;

// Views
function getVault(uint256 vaultId)        external view returns (address owner, uint256 lastPing, uint256 pingInterval, uint256 ethBalance, VaultStatus status, uint256 claimsReceived, uint256 claimThreshold);
function getVaultExtras(uint256 vaultId)  external view returns (uint256 claimGracePeriod, uint256 distributionStartedAt, address[] tokens, uint256[] tokenBalances);
function getHeirs(uint256 vaultId)        external view returns (Heir[] memory);
function getVaultsByOwner(address owner)  external view returns (uint256[] memory);
function getVaultsByHeir(address heir)    external view returns (uint256[] memory);
function isExpired(uint256 vaultId)       external view returns (bool);
function timeUntilExpiry(uint256 vaultId) external view returns (uint256);

// Events
event VaultCreated(uint256 indexed vaultId, address indexed owner, uint256 pingInterval, uint256 claimGracePeriod, uint256 claimThreshold, uint256 heirCount, uint256 initialDeposit);
event Pinged       (uint256 indexed vaultId, address indexed owner, uint256 lastPing);
event Deposited    (uint256 indexed vaultId, address indexed from,  address indexed token, uint256 amount);
event ClaimInitiated(uint256 indexed vaultId, address indexed heir, uint256 claimsReceived);
event Distributed  (uint256 indexed vaultId, address indexed caller);
event Cancelled    (uint256 indexed vaultId, address indexed owner);
```

---

## 🔐 Security considerations

- **Reentrancy.** `depositETH`, `depositERC20`, `cancel`, and `distribute` all use OpenZeppelin's `ReentrancyGuard`. A test (`ReentrancyGuard › blocks reentrant distribute via malicious heir`) exercises a malicious heir contract that attempts to reenter `distribute()` from its `receive()` hook.
- **Custom errors.** All revert paths use named custom errors (`PercentagesMustSumTo100`, `NotHeir`, etc.) instead of revert strings — cheaper at runtime and easier to decode in the UI.
- **Bounded loops.** Heir count is capped at `MAX_HEIRS = 20` to prevent griefing via gas exhaustion. Token loops are bounded by however many distinct tokens have been deposited.
- **Safe ERC-20 transfers.** All token movement uses `SafeERC20`, which handles the non-conforming-token quirks (e.g. USDT pre-2020).
- **No `selfdestruct` / `delegatecall`.** No upgrade backdoors, no admin keys.
- **Force-fed ETH.** The contract's `receive()` reverts. Funds can only enter via `createVault` or `depositETH`, where they are properly accounted in the per-vault balance. Direct `selfdestruct` from another contract is impossible since Solidity 0.8 deprecated it; even if force-fed, the bookkeeping is unaffected because we track balances explicitly rather than reading `address(this).balance`.
- **Dust → last heir.** ETH and token splits are computed by floor division for all heirs except the last one, which receives the remainder. Total payout exactly equals total balance.
- **Time bounds.** `pingInterval` ∈ [60s, 10 years]; `claimGracePeriod` ∈ [0, 1 year]. These guard against absurd configurations.

### Known limitations

- Heirs must still hold and protect their own keys; if an heir loses theirs, their share is locked.
- Distribution gas grows linearly with heirs × tokens. With 20 heirs and several tokens this is well under block-gas-limit, but extreme configurations should be tested in advance.
- The contract trusts the owner's wallet not to be lost: a stolen ping key looks the same as a live owner.

---

## 📄 License

MIT — see [LICENSE](./LICENSE).

---

_Built for **NYU CS-GY 9223 — Blockchain & Distributed Ledger Technologies** · Spring 2026._
