"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getReadVault,
  getWriteVault,
  ensureSepolia,
  VAULT_STATUS,
  addressUrl,
} from "@/lib/contract";
import { fmtEth, shortAddr } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import CountdownTimer from "@/components/CountdownTimer";
import TxModal from "@/components/TxModal";
import styles from "./heir.module.css";

export default function HeirPage() {
  const [account, setAccount] = useState(null);
  const [vaults, setVaults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tx, setTx] = useState({ status: null, hash: null, message: "" });

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
      const ids = await v.getVaultsByHeir(addr);
      const enriched = await Promise.all(
        ids.map(async (id) => {
          const data = await v.getVault(id);
          const extras = await v.getVaultExtras(id);
          const heirs = await v.getHeirs(id);
          const me = heirs.find(
            (h) => h.wallet.toLowerCase() === addr.toLowerCase()
          );
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
            heirs,
            myPercentage: me ? Number(me.percentage) : 0,
            iAlreadyInitiated: me ? me.hasInitiated : false,
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

  const initiate = async (vaultId) => {
    setTx({ status: "pending", hash: null, message: "Confirm claim in wallet…" });
    try {
      await ensureSepolia();
      const vault = await getWriteVault();
      const t = await vault.initiateClaim(vaultId);
      setTx({ status: "pending", hash: t.hash, message: "Mining claim…" });
      await t.wait();
      setTx({ status: "confirmed", hash: t.hash, message: "Claim initiated." });
      await load(account);
    } catch (err) {
      setTx({
        status: "failed",
        hash: null,
        message: err?.shortMessage || err?.message || "Claim failed",
      });
    }
  };

  if (!account) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>As Heir</h1>
        <div className={styles.empty}>Connect your wallet to view vaults you can claim from.</div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>As Heir</h1>
      <p className={styles.subtitle}>
        Vaults that have named you as an heir. Initiate a claim once the vault expires.
      </p>

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : vaults.length === 0 ? (
        <div className={styles.empty}>No one has named you as an heir yet.</div>
      ) : (
        <div className={styles.list}>
          {vaults.map((v) => {
            const expiry = v.lastPing + v.pingInterval;
            const expired = Math.floor(Date.now() / 1000) > expiry;
            const distributable =
              v.status === "ClaimPeriod" &&
              Math.floor(Date.now() / 1000) >= v.distributionStartedAt + v.gracePeriod;
            return (
              <div key={v.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.vaultIdLabel}>Vault</span>
                    <span className={styles.vaultId}>#{v.id}</span>
                    <div style={{ marginTop: "0.4rem" }}>
                      <span className={styles.statLabel}>Owner</span>
                      <a
                        href={addressUrl(v.owner)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.ownerLink}
                      >
                        {shortAddr(v.owner)} ↗
                      </a>
                    </div>
                  </div>
                  <StatusBadge status={v.status} expired={expired} />
                </div>

                <div className={styles.statsRow}>
                  <div>
                    <span className={styles.statLabel}>Your share</span>
                    <span className={styles.statValue}>{v.myPercentage}%</span>
                  </div>
                  <div>
                    <span className={styles.statLabel}>ETH in vault</span>
                    <span className={styles.statValue}>{fmtEth(v.ethBalance)} ETH</span>
                  </div>
                  <div>
                    <span className={styles.statLabel}>Claims</span>
                    <span className={styles.statValue}>
                      {v.claimsReceived} / {v.claimThreshold}
                    </span>
                  </div>
                  {v.status === "Active" && !expired ? (
                    <CountdownTimer
                      targetTimestamp={expiry}
                      label="Owner must ping by"
                      expiredText="Now claimable"
                    />
                  ) : null}
                  {v.status === "ClaimPeriod" ? (
                    <CountdownTimer
                      targetTimestamp={v.distributionStartedAt + v.gracePeriod}
                      label="Distribute in"
                      expiredText="Ready to distribute"
                    />
                  ) : null}
                </div>

                <div className={styles.actionRow}>
                  {(v.status === "Active" && expired) || v.status === "ClaimPeriod" ? (
                    <button
                      className={styles.initiateBtn}
                      onClick={() => initiate(v.id)}
                      disabled={v.iAlreadyInitiated}
                      title={
                        v.iAlreadyInitiated
                          ? "You already initiated"
                          : "Submit your claim"
                      }
                    >
                      {v.iAlreadyInitiated ? "✓ You initiated" : "Initiate Claim"}
                    </button>
                  ) : null}
                  {v.status === "ClaimPeriod" || v.status === "Distributed" ? (
                    <Link href={`/claim/${v.id}`} className={styles.detailsBtn}>
                      View Details →
                    </Link>
                  ) : null}
                </div>

                {v.status === "Active" && !expired ? (
                  <p className={styles.note}>Cannot claim until owner&apos;s ping window has elapsed.</p>
                ) : null}
                {distributable ? (
                  <p className={styles.note}>Grace period is over — anyone can call distribute.</p>
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
