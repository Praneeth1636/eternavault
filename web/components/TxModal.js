"use client";

import { useEffect } from "react";
import { txUrl } from "@/lib/contract";
import styles from "./TxModal.module.css";

// status: "pending" | "confirmed" | "failed" | null
export default function TxModal({ status, txHash, message, onClose }) {
  useEffect(() => {
    if (status === "confirmed") {
      const t = setTimeout(() => onClose && onClose(), 3000);
      return () => clearTimeout(t);
    }
  }, [status, onClose]);

  if (!status) return null;

  return (
    <div className={styles.overlay} onClick={status === "failed" ? onClose : undefined}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {status === "pending" && (
          <>
            <div className={styles.spinner} />
            <h3 className={styles.title}>Transaction pending…</h3>
            <p className={styles.body}>{message || "Waiting for confirmation."}</p>
            {txHash && (
              <a className={styles.link} href={txUrl(txHash)} target="_blank" rel="noopener noreferrer">
                View on Etherscan ↗
              </a>
            )}
          </>
        )}

        {status === "confirmed" && (
          <>
            <div className={styles.check}>✓</div>
            <h3 className={styles.title}>Confirmed</h3>
            <p className={styles.body}>{message || "Your transaction was mined."}</p>
            {txHash && (
              <a className={styles.link} href={txUrl(txHash)} target="_blank" rel="noopener noreferrer">
                View on Etherscan ↗
              </a>
            )}
          </>
        )}

        {status === "failed" && (
          <>
            <div className={styles.cross}>×</div>
            <h3 className={styles.title}>Transaction failed</h3>
            <p className={styles.body}>{message || "Something went wrong."}</p>
            <button className={styles.close} onClick={onClose}>
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
