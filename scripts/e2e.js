/* eslint-disable no-console */
const hre = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  blue: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function step(n, label) {
  console.log(`\n${c.bold(c.blue(`[${n}] ${label}`))}`);
}
function ok(label) {
  console.log(`  ${c.green("✓")} ${label}`);
}
function fail(label, err) {
  console.log(`  ${c.red("✗")} ${label}`);
  if (err) console.log(c.dim(`    ${err.message || err}`));
  process.exitCode = 1;
}
function info(label) {
  console.log(`  ${c.dim("·")} ${c.dim(label)}`);
}

function eq(actual, expected, label) {
  if (actual === expected || (typeof actual === "bigint" && actual === BigInt(expected))) {
    ok(`${label} (${actual})`);
  } else {
    fail(`${label} — expected ${expected}, got ${actual}`);
  }
}

async function main() {
  const network = hre.network.name;
  if (network !== "hardhat" && network !== "localhost") {
    console.log(c.red("This script must be run against an in-process Hardhat chain (no --network flag, or --network hardhat)."));
    process.exit(1);
  }

  console.log(c.bold("\n════ EternaVault end-to-end test ════"));
  info(`network: ${network}`);

  const [owner, alice, bob, carol] = await hre.ethers.getSigners();
  info(`owner:  ${owner.address}`);
  info(`alice:  ${alice.address} (heir, 70%)`);
  info(`bob:    ${bob.address} (heir, 30%)`);
  info(`carol:  ${carol.address} (non-heir, will trigger distribute)`);

  // ─────────────────────────────────────────────────────────
  step(1, "Deploy EternaVault");
  const Vault = await hre.ethers.getContractFactory("EternaVault");
  const vault = await Vault.deploy();
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  ok(`deployed at ${vaultAddr}`);

  // ─────────────────────────────────────────────────────────
  step(2, "Create vault: 1 ETH, alice 70% / bob 30%, ping=60s, grace=60s, threshold=1");
  const tx0 = await vault.createVault(
    [alice.address, bob.address],
    [70, 30],
    60n,
    60n,
    1n,
    { value: hre.ethers.parseEther("1.0") }
  );
  const r0 = await tx0.wait();
  const created = r0.logs.find((l) => l.fragment?.name === "VaultCreated");
  if (!created) return fail("VaultCreated event not emitted");
  ok("VaultCreated event emitted");
  const vaultId = created.args.vaultId;
  eq(Number(vaultId), 0, "vaultId");
  const v0 = await vault.getVault(vaultId);
  eq(v0.ethBalance, hre.ethers.parseEther("1.0"), "ethBalance == 1.0 ETH");
  eq(Number(v0.status), 0, "status == Active");

  // ─────────────────────────────────────────────────────────
  step(3, "Ping resets the countdown");
  const before = (await vault.getVault(vaultId)).lastPing;
  await time.increase(30);
  await (await vault.ping(vaultId)).wait();
  const after = (await vault.getVault(vaultId)).lastPing;
  if (after > before) ok(`lastPing advanced (${before} → ${after})`);
  else fail("lastPing did not advance after ping");

  // ─────────────────────────────────────────────────────────
  step(4, "Owner cannot ping after expiry");
  await time.increase(120);
  try {
    await vault.ping(vaultId);
    fail("ping should have reverted after expiry");
  } catch (err) {
    if ((err.message || "").includes("VaultExpired")) ok("ping reverted with VaultExpired");
    else fail(`ping reverted with wrong error`, err);
  }

  // ─────────────────────────────────────────────────────────
  step(5, "Heir alice initiates the claim");
  const tx1 = await vault.connect(alice).initiateClaim(vaultId);
  const r1 = await tx1.wait();
  const initiated = r1.logs.find((l) => l.fragment?.name === "ClaimInitiated");
  if (!initiated) fail("ClaimInitiated not emitted");
  else ok("ClaimInitiated emitted");
  const v1 = await vault.getVault(vaultId);
  eq(Number(v1.status), 1, "status == ClaimPeriod (threshold met)");
  eq(Number(v1.claimsReceived), 1, "claimsReceived == 1");

  // ─────────────────────────────────────────────────────────
  step(6, "distribute() reverts before grace period elapses");
  try {
    await vault.distribute(vaultId);
    fail("distribute should have reverted before grace period");
  } catch (err) {
    if ((err.message || "").includes("GracePeriodNotElapsed"))
      ok("reverted with GracePeriodNotElapsed");
    else fail("wrong revert reason", err);
  }

  // ─────────────────────────────────────────────────────────
  step(7, "Wait out the grace period and distribute (called by carol, a non-heir)");
  await time.increase(70);

  const aliceBefore = await hre.ethers.provider.getBalance(alice.address);
  const bobBefore = await hre.ethers.provider.getBalance(bob.address);

  await (await vault.connect(carol).distribute(vaultId)).wait();
  ok("distribute() succeeded");

  const aliceAfter = await hre.ethers.provider.getBalance(alice.address);
  const bobAfter = await hre.ethers.provider.getBalance(bob.address);

  const aliceDelta = aliceAfter - aliceBefore;
  const bobDelta = bobAfter - bobBefore;
  const expectedAlice = hre.ethers.parseEther("0.7");
  const expectedBob = hre.ethers.parseEther("0.3");

  if (aliceDelta === expectedAlice) ok(`alice received exactly 0.7 ETH`);
  else fail(`alice received ${hre.ethers.formatEther(aliceDelta)} ETH, expected 0.7`);

  if (bobDelta === expectedBob) ok(`bob received exactly 0.3 ETH`);
  else fail(`bob received ${hre.ethers.formatEther(bobDelta)} ETH, expected 0.3`);

  const v2 = await vault.getVault(vaultId);
  eq(Number(v2.status), 2, "status == Distributed");
  eq(v2.ethBalance, 0n, "vault ethBalance == 0");

  // ─────────────────────────────────────────────────────────
  step(8, "Cancel flow on a fresh vault");
  await (await vault.createVault([alice.address], [100], 3600n, 0n, 1n, {
    value: hre.ethers.parseEther("0.25"),
  })).wait();
  const ownerBalBefore = await hre.ethers.provider.getBalance(owner.address);
  const cancelTx = await vault.cancel(1n);
  const cancelReceipt = await cancelTx.wait();
  const gasCost = cancelReceipt.gasUsed * cancelReceipt.gasPrice;
  const ownerBalAfter = await hre.ethers.provider.getBalance(owner.address);
  const refunded = ownerBalAfter - ownerBalBefore + gasCost;
  if (refunded === hre.ethers.parseEther("0.25"))
    ok("owner received exactly 0.25 ETH back (gas-adjusted)");
  else fail(`owner refund mismatch: ${hre.ethers.formatEther(refunded)} vs 0.25`);

  // ─────────────────────────────────────────────────────────
  console.log(c.bold(c.green("\n════ All end-to-end checks passed ════\n")));
}

main().catch((err) => {
  console.error(c.red("\nE2E run failed:"));
  console.error(err);
  process.exit(1);
});
