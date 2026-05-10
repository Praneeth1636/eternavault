"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import {
  getReadVault,
  getWriteVault,
  ensureSepolia,
  VAULT_STATUS,
  addressUrl,
} from "@/lib/contract";
import { fmtEth, fmtToken, fmtDuration, shortAddr } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import CountdownTimer from "@/components/CountdownTimer";
import HeirList from "@/components/HeirList";
import TxModal from "@/components/TxModal";
import styles from "./myVault.module.css";

export default function MyVaultPage() {
  const [account, setAccount] = useState(null);
  const [vaults, setVaults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tx, setTx] = useState({ status: null, hash: null, message: "" });
  const [depositingFor, setDepositingFor] = useState(null);
  const [depositAmt, setDepositAmt] = useState("");

  const load = useCallback(async (addr) => {
    if (!addr) {
      setVaults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const v = await getReadVault();
      if (!v) return;
      const ids = await v.getVaultsByOwner(addr);
      const enriched = await Promise.all(
        ids.map(async (id) => {
          const data = await v.getVault(id);
          const extras = await v.getVaultExtras(id);
          const heirs = await v.getHeirs(id);
          return {
            id: Number(id),
            owner: data.owner,
            lastPing: Number(data.lastPing),
            pingInterval: Number(data.pingInterval),
            ethBalance: data.ethBalance,
            status: VAULT_STATUS[Number(data.status)],
            claimsReceived: Number(data.claimsReceived),
            claimThreshold: Number(data.claimThreshold),
            gracePeriod: Number(extras.claimGracePeriod),
            distributionStartedAt: Number(extras.distributionStartedAt),
            tokens: extras.tokens,
            tokenBalances: extras.tokenBalances,
            heirs,
          };
        })
      );
      setVaults(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const accs = await window.ethereum.request({ method: "eth_accounts" });
        const a = accs && accs[0] ? accs[0] : null;
        if (!cancelled) {
          setAccount(a);
          await load(a);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    const onAccs = async (a) => {
      const addr = a && a[0] ? a[0] : null;
      setAccount(addr);
      await load(addr);
    };
    window.ethereum.on("accountsChanged", onAccs);
    return () => {
      cancelled = true;
      window.ethereum?.removeListener?.("accountsChanged", onAccs);
    };
  }, [load]);

  const ping = async (vaultId) => {
    setTx({ status: "pending", hash: null, message: "Confirm ping in your wallet…" });
    try {
      await ensureSepolia();
      const vault = await getWriteVault();
      const t = await vault.ping(vaultId);
      setTx({ status: "pending", hash: t.hash, message: "Mining ping…" });
      await t.wait();
      setTx({ status: "confirmed", hash: t.hash, message: "Ping recorded." });
      await load(account);
    } catch (err) {
      setTx({
        status: "failed",
        hash: null,
        message: err?.shortMessage || err?.message || "Ping failed",
      });
    }
  };

  const cancel = async (vaultId) => {
    if (!confirm(`Cancel vault #${vaultId}? All ETH and tokens will be returned to you.`)) return;
    setTx({ status: "pending", hash: null, message: "Confirm cancel in your wallet…" });
    try {
      await ensureSepolia();
      const vault = await getWriteVault();
      const t = await vault.cancel(vaultId);
      setTx({ status: "pending", hash: t.hash, message: "Mining cancel…" });
      await t.wait();
      setTx({ status: "confirmed", hash: t.hash, message: "Vault cancelled. Funds returned." });
      await load(account);
    } catch (err) {
      setTx({
        status: "failed",
        hash: null,
        message: err?.shortMessage || err?.message || "Cancel failed",
      });
    }
  };

  const deposit = async (vaultId) => {
    if (!depositAmt || Number(depositAmt) <= 0) return;
    setTx({ status: "pending", hash: null, message: "Confirm deposit…" });
    try {
      await ensureSepolia();
      const vault = await getWriteVault();
      const t = await vault.depositETH(vaultId, {
        value: ethers.parseEther(depositAmt),
      });
      setTx({ status: "pending", hash: t.hash, message: "Mining deposit…" });
      await t.wait();
      setTx({ status: "confirmed", hash: t.hash, message: "Deposit successful." });
      setDepositingFor(null);
      setDepositAmt("");
      await load(account);
    } catch (err) {
      setTx({
        status: "failed",
        hash: null,
        message: err?.shortMessage || err?.message || "Deposit failed",
      });
    }
  };

  if (!account) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>My Vaults</h1>
        <div className={styles.empty}>Connect your wallet to view your vaults.</div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>My Vaults</h1>
      <p className={styles.subtitle}>
        Vaults you own. Ping regularly to keep them active.
      </p>

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : vaults.length === 0 ? (
        <div className={styles.empty}>
          No vaults yet. <Link href="/create">Create your first vault →</Link>
        </div>
      ) : (
        <div className={styles.list}>
          {vaults.map((v) => {
            const expiry = v.lastPing + v.pingInterval;
            const expired = Math.floor(Date.now() / 1000) > expiry;
            const isActive = v.status === "Active" && !expired;
            const canCancel = v.status === "Active" || v.status === "ClaimPeriod";
            return (
              <div key={v.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.vaultIdLabel}>Vault</span>
                    <span className={styles.vaultId}>#{v.id}</span>
                  </div>
                  <StatusBadge status={v.status} expired={expired} />
                </div>

                <div className={styles.statsRow}>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>ETH Balance</span>
                    <span className={styles.statValue}>{fmtEth(v.ethBalance)} ETH</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Heirs</span>
                    <span className={styles.statValue}>
                      {v.heirs.length} (need {v.claimThreshold})
                    </span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Ping interval</span>
                    <span className={styles.statValue}>{fmtDuration(v.pingInterval)}</span>
                  </div>
                  {v.status === "Active" ? (
                    <CountdownTimer
                      targetTimestamp={expiry}
                      label="Next ping by"
                      expiredText="Expired — cancel or let heirs claim"
                    />
                  ) : null}
                </div>

                {v.tokens && v.tokens.length > 0 ? (
                  <div className={styles.tokenList}>
                    Tokens deposited:
                    {v.tokens.map((t, i) => (
                      <a
                        key={t}
                        className={styles.tokenChip}
                        href={addressUrl(t)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {shortAddr(t)} — {fmtToken(v.tokenBalances[i])}
                      </a>
                    ))}
                  </div>
                ) : null}

                <div className={styles.heirsBlock}>
                  <HeirList heirs={v.heirs} showInitiated={v.status === "ClaimPeriod"} />
                </div>

                <div className={styles.actionRow}>
                  <button
                    className={styles.pingBtn}
                    disabled={!isActive}
                    onClick={() => ping(v.id)}
                    title={!isActive ? "Vault is not Active" : "Reset the deadline"}
                  >
                    🟢 Ping
                  </button>
                  {v.status === "Active" ? (
                    <button
                      className={styles.depositBtn}
                      onClick={() =>
                        setDepositingFor(depositingFor === v.id ? null : v.id)
                      }
                    >
                      + Deposit ETH
                    </button>
                  ) : null}
                  {canCancel ? (
                    <button className={styles.cancelBtn} onClick={() => cancel(v.id)}>
                      Cancel Vault
                    </button>
                  ) : null}
                </div>

                {depositingFor === v.id ? (
                  <div className={styles.depositForm}>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="Amount in ETH"
                      value={depositAmt}
                      onChange={(e) => setDepositAmt(e.target.value)}
                    />
                    <button className={styles.depositBtn} onClick={() => deposit(v.id)}>
                      Send
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <TxModal
        status={tx.status}
        txHash={tx.hash}
        message={tx.message}
        onClose={() => setTx({ status: null, hash: null, message: "" })}
      />
    </div>
  );
}
