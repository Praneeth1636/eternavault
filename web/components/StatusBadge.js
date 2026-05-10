"use client";

import styles from "./StatusBadge.module.css";

const LABELS = {
  Active: "Active",
  ClaimPeriod: "Claim Period",
  Distributed: "Distributed",
  Cancelled: "Cancelled",
  Expired: "Expired",
};

export default function StatusBadge({ status, expired }) {
  // If contract status is Active but expired, show "Expired" pill instead
  const key = status === "Active" && expired ? "Expired" : status;
  const cls = styles[key] || styles.Active;
  return (
    <span className={`${styles.badge} ${cls}`}>
      <span className={styles.dot} />
      {LABELS[key] || key}
    </span>
  );
}
