"use client";

import { useEffect, useState } from "react";
import { fmtCountdown } from "@/lib/format";
import styles from "./CountdownTimer.module.css";

// targetTimestamp: unix seconds (number or bigint)
export default function CountdownTimer({ targetTimestamp, label = "Time remaining", expiredText = "Expired" }) {
  const target = Number(targetTimestamp || 0);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const i = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(i);
  }, []);

  const remaining = Math.max(0, target - now);
  const expired = target > 0 && remaining === 0;
  const urgent = !expired && remaining < 5 * 60;

  return (
    <div>
      <span className={styles.label}>{label}</span>
      <div
        className={`${styles.timer} ${urgent ? styles.urgent : ""} ${expired ? styles.expired : ""}`}
      >
        {expired ? expiredText : fmtCountdown(remaining)}
      </div>
    </div>
  );
}
