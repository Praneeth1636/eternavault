"use client";

import { shortAddr, hueFromAddress } from "@/lib/format";
import styles from "./HeirList.module.css";

function Identicon({ address }) {
  const hue1 = hueFromAddress(address);
  const hue2 = (hue1 + 60) % 360;
  return (
    <svg
      className={styles.identicon}
      viewBox="0 0 28 28"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`g-${address}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue1}, 70%, 55%)`} />
          <stop offset="100%" stopColor={`hsl(${hue2}, 70%, 45%)`} />
        </linearGradient>
      </defs>
      <rect width="28" height="28" fill={`url(#g-${address})`} />
    </svg>
  );
}

export default function HeirList({ heirs, showInitiated = false }) {
  if (!heirs || heirs.length === 0) {
    return <p className={styles.empty}>No heirs configured.</p>;
  }
  return (
    <ul className={styles.list}>
      {heirs.map((h, i) => (
        <li key={`${h.wallet}-${i}`} className={styles.item}>
          <Identicon address={h.wallet} />
          <span className={styles.address} title={h.wallet}>
            {shortAddr(h.wallet)}
          </span>
          {showInitiated && h.hasInitiated ? (
            <span className={styles.initiated}>✓ initiated</span>
          ) : null}
          <span className={styles.percentage}>{Number(h.percentage)}%</span>
        </li>
      ))}
    </ul>
  );
}
