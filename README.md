# EternaVault

> **Trustless inheritance for the digital age.**

When a crypto holder dies, their funds are typically lost forever. Heirs don't have the seed phrase, exchanges have inconsistent (and often non-existent) inheritance pathways, and probate courts can't compel a private key into existence. EternaVault solves this on-chain: a "dead-man's switch" smart contract that requires the owner to periodically *ping* it. If the pings stop, designated heirs can claim and distribute the locked ETH and ERC-20 tokens according to pre-set percentages — without lawyers, custodians, or seed-phrase escrow.

**Built for NYU CS-GY 9223 — Blockchain & Distributed Ledger Technologies — Spring 2026.**

---

## 🟢 Live on Sepolia

| | |
|---|---|
| Contract address | [`0x8304B9A0899582e0E0c5d5835fD612035e9107bc`](https://sepolia.etherscan.io/address/0x8304B9A0899582e0E0c5d5835fD612035e9107bc) |
| Network | Sepolia testnet (chainId `11155111`) |
| Solidity | `^0.8.20` |
| Deployed by | `0x4cbC74C64E2b4B07D460C71B81243727d55b566B` |

A successful end-to-end run (vault creation → ping → expiry → heir claim → distribution) is on-chain at the address above. Every step is independently verifiable on Sepolia Etherscan.

---

## ✨ Features

- **Dead-man's switch.** Owner sets a ping interval; missing it triggers the claim window.
- **Multi-heir threshold.** Require N-of-M heirs to initiate a claim before distribution.
- **Configurable grace period.** A cooling-off window during which the owner can still cancel.
- **Cancel anytime.** While Active or in the Claim Period, the owner can pull all funds back.
- **ETH + arbitrary ERC-20s.** Each asset is split proportionally on distribution.
- **Dust handling.** Rounding remainders go to the last heir — every wei is accounted for.
- **Multi-vault.** A single contract hosts independent vaults for any number of users.
- **Custom errors + ReentrancyGuard.** Gas-efficient and reentrancy-safe.
- **Permissionless distribution.** Once the threshold and grace period are satisfied, anyone can call `distribute()` — even a relayer.

---

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| Smart contracts | Solidity `^0.8.20`, OpenZeppelin v5 |
| Toolchain | Hardhat (JavaScript), ethers v6, hardhat-toolbox |
| Tests | Mocha + Chai + `@nomicfoundation/hardhat-network-helpers` |
| Frontend | Next.js 14 (App Router), React 18, ethers v6, CSS Modules |
| Wallet | MetaMask via `window.ethereum` (no Web3Modal) |
| Network | Sepolia testnet + local Hardhat node |
| RPC | Alchemy (URL via `.env`) |

---

## 📊 Test results

```
EternaVault
  createVault                           ✔ 10 tests
  ping                                  ✔  3 tests
  deposits                              ✔  3 tests
  initiateClaim                         ✔  5 tests
  distribute                            ✔  5 tests
  cancel                                ✔  3 tests
  ReentrancyGuard                       ✔  1 test
  multi-vault isolation                 ✔  1 test
  getVaultsByOwner / getVaultsByHeir    ✔  1 test
  views                                 ✔  2 tests

34 passing (594ms)
```

The reentrancy test (`ReentrancyGuard › blocks reentrant distribute via malicious heir`) deploys a `MaliciousReceiver` contract whose `receive()` hook attempts to call back into `distribute()`. The reentrancy guard correctly reverts the attack.

Run the suite yourself:

```bash
npx hardhat compile
npx hardhat test
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

### Prerequisites

- Node.js v20+
- A Sepolia-funded MetaMask account (use a **fresh** wallet — never your main one)
- An [Alchemy](https://www.alchemy.com/) Sepolia app for the RPC URL
- An [Etherscan API key](https://etherscan.io/myapikey) (optional, for auto-verification)

### Install

```bash
# Hardhat (root)
npm install

# Frontend
cd web && npm install && cd ..
```

### Environment

```bash
cp .env.example .env
```

Fill in:

```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your-key>
PRIVATE_KEY=<64-hex-no-0x-prefix>
ETHERSCAN_API_KEY=<optional>
```

> ⚠️ Never commit `.env`. The `.gitignore` already excludes it.

---

## 🌍 Deploy

### Local Hardhat node

```bash
# terminal 1
npx hardhat node

# terminal 2
npx hardhat run scripts/deploy.js --network localhost
```

### Sepolia testnet

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

The script prints a copy-paste block for `web/.env.local`:

```
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_BLOCK_EXPLORER=https://sepolia.etherscan.io
```

---

## 🖥 Run the frontend

```bash
cd web
cp .env.example .env.local   # paste the deployed contract address
npm run dev
```

Open <http://localhost:3000>. The app auto-detects MetaMask, prompts a switch to Sepolia if needed, and reacts to `accountsChanged` / `chainChanged` events.

---

## 🎬 End-to-end demo flow

To demo in under 5 minutes, set `pingInterval = 60s` and `gracePeriod = 60s` (the "1 min (demo)" preset).

1. **Connect** — open `/`, click *Connect Wallet*, switch to Sepolia.
2. **Create** — go to `/create`. Add a heir, 100% split. Pick "1 min (demo)" for both ping interval and grace period. Threshold = 1. Initial deposit = 0.01 ETH. Submit.
3. **My Vaults** — `/my-vault` shows the new vault. The countdown ticks down from 60 s. Click *Ping* to reset it.
4. **Simulate death** — stop pinging. After 60 s, the status flips to *Expired*.
5. **Heir initiates** — switch MetaMask to the heir account. Open `/heir`. Click *Initiate Claim*.
6. **Wait** the grace period (60 s for the demo).
7. **Distribute** — open `/claim/<vaultId>`. Click *Distribute Now*. Funds split into the heir wallets.
8. **Verify** — open the tx on [sepolia.etherscan.io](https://sepolia.etherscan.io). Confirm both heir balances ticked up.

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

function depositETH(uint256 vaultId)                                  external payable;
function depositERC20(uint256 vaultId, address token, uint256 amount) external;
function ping(uint256 vaultId)                                        external;
function cancel(uint256 vaultId)                                      external;
function initiateClaim(uint256 vaultId)                               external;
function distribute(uint256 vaultId)                                  external;

// Views
function getVault(uint256 vaultId)        external view returns (...);
function getVaultExtras(uint256 vaultId)  external view returns (...);
function getHeirs(uint256 vaultId)        external view returns (Heir[] memory);
function getVaultsByOwner(address owner)  external view returns (uint256[] memory);
function getVaultsByHeir(address heir)    external view returns (uint256[] memory);
function isExpired(uint256 vaultId)       external view returns (bool);
function timeUntilExpiry(uint256 vaultId) external view returns (uint256);

// Events
event VaultCreated   (uint256 indexed vaultId, address indexed owner, ...);
event Pinged         (uint256 indexed vaultId, address indexed owner, uint256 lastPing);
event Deposited      (uint256 indexed vaultId, address indexed from, address indexed token, uint256 amount);
event ClaimInitiated (uint256 indexed vaultId, address indexed heir, uint256 claimsReceived);
event Distributed    (uint256 indexed vaultId, address indexed caller);
event Cancelled      (uint256 indexed vaultId, address indexed owner);
```

---

## 🔐 Security considerations

- **Reentrancy.** `depositETH`, `depositERC20`, `cancel`, and `distribute` all use OpenZeppelin's `ReentrancyGuard`. The reentrancy test exercises a malicious heir contract that attempts to reenter `distribute()` from its `receive()` hook.
- **Custom errors.** All revert paths use named custom errors (`PercentagesMustSumTo100`, `NotHeir`, `VaultNotExpired`, etc.) instead of revert strings — cheaper at runtime and easier to decode in the UI.
- **Bounded loops.** Heir count is capped at `MAX_HEIRS = 20` to prevent griefing via gas exhaustion. Token loops are bounded by however many distinct tokens have been deposited.
- **Safe ERC-20 transfers.** All token movement uses `SafeERC20`, which handles non-conforming tokens (e.g. USDT pre-2020).
- **No `selfdestruct` / `delegatecall`.** No upgrade backdoors, no admin keys.
- **Force-fed ETH.** The contract's `receive()` reverts. Funds can only enter via `createVault` or `depositETH`. Even if force-fed (e.g. via a `selfdestruct` of another contract), the bookkeeping is unaffected because we track balances explicitly rather than reading `address(this).balance`.
- **Dust → last heir.** ETH and token splits are computed by floor division for all heirs except the last one, which receives the remainder. Total payout exactly equals total balance.
- **Time bounds.** `pingInterval` ∈ [60 s, 10 years]; `claimGracePeriod` ∈ [0, 1 year]. These guard against absurd configurations.

### Known limitations

- Heirs must still hold and protect their own keys; if an heir loses theirs, their share is locked.
- Distribution gas grows linearly with `heirs × tokens`. With 20 heirs and several tokens this is well under the block-gas-limit, but extreme configurations should be tested in advance.
- The contract trusts the owner's wallet not to be lost: a stolen ping key looks the same as a live owner.

---

## 👥 Authors

- **Praneeth Kadem** — [@Praneeth1636](https://github.com/Praneeth1636) - pk3206
- **Bhavana Peruri** — [@bhavana301](https://github.com/bhavana301) - bp2847

Both authors pair-programmed all components — contract design, test suite, frontend, deployment, and documentation — with both reviewing every commit.

---

## 📄 License

MIT — see [LICENSE](./LICENSE).

---

*Built for **NYU CS-GY 9223 — Blockchain & Distributed Ledger Technologies** · Spring 2026.*
