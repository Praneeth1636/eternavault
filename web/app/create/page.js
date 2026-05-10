"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ethers } from "ethers";
import { getWriteVault, ensureSepolia } from "@/lib/contract";
import TxModal from "@/components/TxModal";
import styles from "./create.module.css";

const PING_PRESETS = [
  { label: "1 min (demo)", seconds: 60 },
  { label: "30 days", seconds: 30 * 86400 },
  { label: "90 days", seconds: 90 * 86400 },
  { label: "1 year", seconds: 365 * 86400 },
];

const GRACE_PRESETS = [
  { label: "1 min (demo)", seconds: 60 },
  { label: "7 days", seconds: 7 * 86400 },
  { label: "30 days", seconds: 30 * 86400 },
];

export default function CreateVaultPage() {
  const router = useRouter();

  const [heirs, setHeirs] = useState([
    { wallet: "", percentage: 100 },
  ]);
  const [pingInterval, setPingInterval] = useState(60);
  const [gracePeriod, setGracePeriod] = useState(60);
  const [threshold, setThreshold] = useState(1);
  const [initialEth, setInitialEth] = useState("0");

  const [tx, setTx] = useState({ status: null, hash: null, message: "" });
  const [submitting, setSubmitting] = useState(false);

  const [account, setAccount] = useState(null);
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((a) => setAccount(a && a[0]))
      .catch(() => {});
    const onAccs = (a) => setAccount(a && a[0]);
    window.ethereum.on("accountsChanged", onAccs);
    return () => window.ethereum?.removeListener?.("accountsChanged", onAccs);
  }, []);

  const sumPct = useMemo(
    () => heirs.reduce((s, h) => s + Number(h.percentage || 0), 0),
    [heirs]
  );
  const duplicates = useMemo(() => {
    const seen = new Set();
    for (const h of heirs) {
      const w = (h.wallet || "").toLowerCase().trim();
      if (!w) continue;
      if (seen.has(w)) return true;
      seen.add(w);
    }
    return false;
  }, [heirs]);

  const selfHeir = useMemo(
    () =>
      account
        ? heirs.some(
            (h) =>
              (h.wallet || "").toLowerCase().trim() === account.toLowerCase()
          )
        : false,
    [heirs, account]
  );

  const allValidAddrs = heirs.every(
    (h) => h.wallet && ethers.isAddress(h.wallet.trim())
  );

  const validationError = (() => {
    if (heirs.length === 0) return "At least one heir is required.";
    if (!allValidAddrs) return "All heir addresses must be valid Ethereum addresses.";
    if (duplicates) return "Duplicate heir addresses are not allowed.";
    if (selfHeir) return "You cannot list yourself as an heir.";
    if (sumPct !== 100) return `Percentages must sum to 100 (currently ${sumPct}).`;
    if (threshold < 1 || threshold > heirs.length)
      return `Threshold must be between 1 and ${heirs.length}.`;
    if (pingInterval < 60) return "Ping interval must be at least 60 seconds.";
    return null;
  })();

  const updateHeir = (i, key, value) => {
    setHeirs((prev) => prev.map((h, idx) => (idx === i ? { ...h, [key]: value } : h)));
  };
  const addHeir = () => setHeirs((prev) => [...prev, { wallet: "", percentage: 0 }]);
  const removeHeir = (i) => setHeirs((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    if (validationError) return;
    setSubmitting(true);
    setTx({ status: "pending", hash: null, message: "Confirm in your wallet…" });

    try {
      await ensureSepolia();
      const vault = await getWriteVault();
      const wallets = heirs.map((h) => h.wallet.trim());
      const pcts = heirs.map((h) => Number(h.percentage));
      const value = initialEth && Number(initialEth) > 0 ? ethers.parseEther(initialEth) : 0n;

      const txResp = await vault.createVault(
        wallets,
        pcts,
        BigInt(pingInterval),
        BigInt(gracePeriod),
        BigInt(threshold),
        { value }
      );
      setTx({ status: "pending", hash: txResp.hash, message: "Mining transaction…" });
      const receipt = await txResp.wait();
      setTx({
        status: "confirmed",
        hash: receipt.hash,
        message: "Vault created. Redirecting…",
      });
      setTimeout(() => router.push("/my-vault"), 2500);
    } catch (err) {
      console.error(err);
      setTx({
        status: "failed",
        hash: null,
        message: err?.shortMessage || err?.message || "Transaction failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Create a Vault</h1>
      <p className={styles.subtitle}>
        Set up a trustless inheritance plan. Once created, only you can ping or cancel
        until the deadline lapses.
      </p>

      <form className={styles.card} onSubmit={submit}>
        <div className={styles.field}>
          <label className={styles.label}>Heirs</label>
          {heirs.map((h, i) => (
            <div key={i} className={styles.heirRow}>
              <input
                type="text"
                placeholder="0x…"
                value={h.wallet}
                onChange={(e) => updateHeir(i, "wallet", e.target.value)}
              />
              <input
                type="number"
                min="0"
                max="100"
                placeholder="%"
                value={h.percentage}
                onChange={(e) => updateHeir(i, "percentage", e.target.value)}
              />
              {heirs.length > 1 && (
                <button type="button" className={styles.removeBtn} onClick={() => removeHeir(i)}>
                  ✕
                </button>
              )}
            </div>
          ))}
          <button type="button" className={styles.addBtn} onClick={addHeir}>
            + Add heir
          </button>
          <div className={styles.sumLine}>
            <span className={styles.help}>Percentages must total exactly 100.</span>
            <span className={sumPct === 100 ? styles.sumOk : styles.sumBad}>
              Sum: {sumPct}%
            </span>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Ping Interval</label>
          <div className={styles.quickRow}>
            {PING_PRESETS.map((p) => (
              <button
                type="button"
                key={p.seconds}
                className={`${styles.quickBtn} ${
                  pingInterval === p.seconds ? styles.quickActive : ""
                }`}
                onClick={() => setPingInterval(p.seconds)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="60"
            value={pingInterval}
            onChange={(e) => setPingInterval(Number(e.target.value))}
            style={{ marginTop: "0.5rem" }}
          />
          <div className={styles.help}>Seconds. Minimum 60. You must ping the contract within this window.</div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Claim Grace Period</label>
          <div className={styles.quickRow}>
            {GRACE_PRESETS.map((p) => (
              <button
                type="button"
                key={p.seconds}
                className={`${styles.quickBtn} ${
                  gracePeriod === p.seconds ? styles.quickActive : ""
                }`}
                onClick={() => setGracePeriod(p.seconds)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="0"
            value={gracePeriod}
            onChange={(e) => setGracePeriod(Number(e.target.value))}
            style={{ marginTop: "0.5rem" }}
          />
          <div className={styles.help}>
            Cooling period after the threshold is met before funds can be distributed.
          </div>
        </div>

        <div className={styles.row2}>
          <div className={styles.field}>
            <label className={styles.label}>Claim Threshold</label>
            <input
              type="number"
              min="1"
              max={heirs.length}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            <div className={styles.help}>Heirs needed to start the claim period.</div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Initial ETH Deposit</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={initialEth}
              onChange={(e) => setInitialEth(e.target.value)}
            />
            <div className={styles.help}>You can deposit more later.</div>
          </div>
        </div>

        {validationError ? <div className={styles.error}>{validationError}</div> : null}

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={submitting || Boolean(validationError)}
        >
          {submitting ? "Submitting…" : "Create Vault"}
        </button>
      </form>

      <TxModal
        status={tx.status}
        txHash={tx.hash}
        message={tx.message}
        onClose={() => setTx({ status: null, hash: null, message: "" })}
      />
    </div>
  );
}
