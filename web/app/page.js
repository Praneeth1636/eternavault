"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

export default function HomePage() {
  const [account, setAccount] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    let cancelled = false;
    (async () => {
      try {
        const accs = await window.ethereum.request({ method: "eth_accounts" });
        if (!cancelled && accs && accs.length > 0) setAccount(accs[0]);
      } catch (e) {
        console.error(e);
      }
    })();
    const onAccs = (a) => setAccount(a && a.length > 0 ? a[0] : null);
    window.ethereum.on("accountsChanged", onAccs);
    return () => {
      cancelled = true;
      window.ethereum?.removeListener?.("accountsChanged", onAccs);
    };
  }, []);

  return (
    <>
      <section className={styles.hero}>
        <h1 className={styles.title}>EternaVault</h1>
        <p className={styles.tagline}>
          Trustless inheritance for the digital age. A dead-man&apos;s switch contract that
          ensures your crypto reaches the people you choose — without lawyers, custodians,
          or seed-phrase escrow.
        </p>
        {account ? (
          <div className={styles.ctaRow}>
            <Link href="/create" className={`${styles.cta} ${styles.ctaPrimary}`}>
              Create a Vault →
            </Link>
            <Link href="/my-vault" className={`${styles.cta} ${styles.ctaSecondary}`}>
              View My Vaults
            </Link>
            <Link href="/heir" className={`${styles.cta} ${styles.ctaSecondary}`}>
              View Claims
            </Link>
          </div>
        ) : (
          <div className={styles.ctaRow}>
            <p className={styles.notice}>Connect your wallet using the button in the top right to begin.</p>
          </div>
        )}
      </section>

      <section className={styles.features}>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>⏱</div>
          <h3 className={styles.featureTitle}>Dead Man&apos;s Switch</h3>
          <p className={styles.featureBody}>
            Ping the contract on a schedule you choose. If you stop, your designated heirs
            can claim and distribute the funds — guaranteed by code.
          </p>
        </div>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>👥</div>
          <h3 className={styles.featureTitle}>Multi-Heir Threshold</h3>
          <p className={styles.featureBody}>
            Require an N-of-M heir consensus before distribution begins, plus a configurable
            grace period that lets you cancel if you&apos;re alive after all.
          </p>
        </div>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>💎</div>
          <h3 className={styles.featureTitle}>ETH + Token Support</h3>
          <p className={styles.featureBody}>
            Deposit native ETH and any ERC-20 token. On distribution, each asset is split
            proportionally according to the percentages you set.
          </p>
        </div>
      </section>
    </>
  );
}
