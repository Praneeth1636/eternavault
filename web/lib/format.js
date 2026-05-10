import { ethers } from "ethers";

export function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function fmtEth(wei) {
  if (wei === undefined || wei === null) return "0";
  try {
    const v = ethers.formatEther(wei);
    const num = Number(v);
    if (num === 0) return "0";
    if (num < 0.0001) return "< 0.0001";
    return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
  } catch {
    return String(wei);
  }
}

export function fmtToken(amount, decimals = 18) {
  if (amount === undefined || amount === null) return "0";
  try {
    const v = ethers.formatUnits(amount, decimals);
    const num = Number(v);
    if (num === 0) return "0";
    if (num < 0.0001) return "< 0.0001";
    return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
  } catch {
    return String(amount);
  }
}

export function fmtDuration(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return "0s";
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function fmtCountdown(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds)));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  const pad = (n) => String(n).padStart(2, "0");

  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

// Deterministic hue from an address — used by HeirList identicon.
export function hueFromAddress(addr) {
  if (!addr) return 0;
  let hash = 0;
  for (let i = 2; i < addr.length; i++) {
    hash = (hash * 31 + addr.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
