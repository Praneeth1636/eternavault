"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getReadVault,
  getWriteVault,
  ensureSepolia,
  VAULT_STATUS,
  addressUrl,
  txUrl,
} from "@/lib/contract";
import { fmtEth, fmtDuration, shortAddr } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import CountdownTimer from "@/components/CountdownTimer";
import HeirList from "@/components/HeirList";
import TxModal from "@/components/TxModal";
import styles from "./claim.module.css";

export default function ClaimPage() {
  const params = useParams();
  const vaultId = params?.vaultId;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tx, setTx] = useState({ status: null, hash: null, message: "" });

  const load = useCallback(async () => {
    if (vaultId === undefined || vaultId === null) return;
    setLoading(true);
    try {
      const v = await getReadVault();
      if (!v) return;
      const id = BigInt(vaultId);
      const d = await v.getVault(id);
      const extras = await v.getVaultExtras(id);
      const heirs = await v.getHeirs(id);
      setData({
        id: Number(id),
        owner: d.owner,
        lastPing: Number(d.lastPing),
        pingInterval: Number(d.pingInterval),
        ethBalance: d.ethBalance,
        status: VAULT_STATUS[Number(d.status)],
        claimsReceived: Number(d.claimsReceived),
        claimThreshold: Number(d.claimThreshold),
        gracePeriod: Number(extras.claimGracePeriod),
        distributionStartedAt: Number(extras.distributionStartedAt),
        heirs,
      });
    } catch (err) {
      console.error(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [vaultId]);

  useEffect(() => {
    load();
  }, [load]);

  const distribute = async () => {
    setTx({ status: "pending", hash: null, message: "Confirm distribute…" });
    try {
      await ensureSepolia();
      const vault = await getWriteVault();
      const t = await vault.distribute(BigInt(vaultId));
      setTx({ status: "pending", hash: t.hash, message: "Mining distribution…" });
      await t.wait();
      setTx({
        status: "confirmed",
        hash: t.hash,
        message: "Distribution complete. Funds sent to all heirs.",
      });
      await load();
    } catch (err) {
      setTx({
        status: "failed",
        hash: null,
        message: err?.shortMessage || err?.message || "Distribution failed",
      });
    }
  };

  if (loading) {
    return (
      <div className={styles.wrap}>
        <Link href="/heir" className={styles.back}>
          ← Back
        </Link>
        <div className={styles.empty}>Loading vault…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.wrap}>
        <Link href="/heir" className={styles.back}>
          ← Back
        </Link>
        <div className={styles.empty}>Vault not found.</div>
      </div>
    );
  }

  const expiry = data.lastPing + data.pingInterval;
  const expired = Math.floor(Date.now() / 1000) > expiry;
  const graceEndsAt = data.distributionStartedAt + data.gracePeriod;
  const canDistribute =
    data.status === "ClaimPeriod" &&
    Math.floor(Date.now() / 1000) >= graceEndsAt;

  return (
    <div className={styles.wrap}>
      <Link href="/heir" className={styles.back}>
        ← Back to your claims
      </Link>

      <div className={styles.headRow}>
        <div>
          <span className={styles.idLabel}>Vault</span>
          <h1 className={styles.title}>#{data.id}</h1>
        </div>
        <StatusBadge status={data.status} expired={expired} />
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Vault Summary</h3>
        <div className={styles.statGrid}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Owner</span>
            <span className={styles.statValue}>
              <a href={addressUrl(data.owner)} target="_blank" rel="noopener noreferrer">
                {shortAddr(data.owner)} ↗
              </a>
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>ETH Balance</span>
            <span className={styles.statValue}>{fmtEth(data.ethBalance)} ETH</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Threshold</span>
            <span className={styles.statValue}>
              {data.claimsReceived} / {data.claimThreshold}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Grace period</span>
            <span className={styles.statValue}>{fmtDuration(data.gracePeriod)}</span>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Heirs</h3>
        <HeirList heirs={data.heirs} showInitiated={true} />
      </div>

      {data.status === "ClaimPeriod" ? (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Distribute Funds</h3>
          {canDistribute ? (
            <>
              <p>
                The grace period has elapsed. Anyone can now trigger distribution. Funds
                will be split according to each heir&apos;s percentage.
              </p>
              <button
                className={styles.distributeBtn}
                onClick={distribute}
                disabled={tx.status === "pending"}
              >
                Distribute Now
              </button>
            </>
          ) : (
            <CountdownTimer
              targetTimestamp={graceEndsAt}
              label="Distribute available in"
              expiredText="Ready to distribute"
            />
          )}
          <p className={styles.note}>Calling distribute is permissionless — anyone can pay the gas.</p>
        </div>
      ) : null}

      {data.status === "Distributed" ? (
        <div className={styles.distributedBadge}>
          <h3>✓ Distributed</h3>
          <p>
            All funds have been distributed to the heirs according to their percentages.
          </p>
          {tx.hash ? (
            <a href={txUrl(tx.hash)} target="_blank" rel="noopener noreferrer">
              View distribution tx ↗
            </a>
          ) : null}
        </div>
      ) : null}

      <TxModal
        status={tx.status}
        txHash={tx.hash}
        message={tx.message}
        onClose={() => setTx({ status: null, hash: null, message: "" })}
      />
    </div>
  );
}
