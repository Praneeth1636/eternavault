"use client";

import { useEffect, useState, useCallback } from "react";
import { ensureChain, CHAIN_ID, CHAIN_ID_HEX, CHAIN_NAME } from "@/lib/contract";
import { shortAddr } from "@/lib/format";
import styles from "./ConnectWallet.module.css";

export default function ConnectWallet({ onAccountChange }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [installed, setInstalled] = useState(true);

  const update = useCallback((addr) => {
    setAccount(addr);
    if (onAccountChange) onAccountChange(addr);
  }, [onAccountChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.ethereum) {
      setInstalled(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (!cancelled && accounts && accounts.length > 0) update(accounts[0]);
        const cid = await window.ethereum.request({ method: "eth_chainId" });
        if (!cancelled) setChainId(cid);
      } catch (err) {
        console.error(err);
      }
    })();

    const onAccounts = (accs) => update(accs && accs.length > 0 ? accs[0] : null);
    const onChain = (cid) => setChainId(cid);

    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);

    return () => {
      cancelled = true;
      window.ethereum?.removeListener?.("accountsChanged", onAccounts);
      window.ethereum?.removeListener?.("chainChanged", onChain);
    };
  }, [update]);

  const connect = async () => {
    if (!window.ethereum) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts && accounts.length > 0) update(accounts[0]);
      try {
        await ensureChain();
      } catch (e) {
        console.warn("Network switch declined", e);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!installed) {
    return (
      <a className={styles.connect} href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">
        Install MetaMask
      </a>
    );
  }

  const wrongNetwork = account && chainId && chainId !== CHAIN_ID_HEX;

  return (
    <>
      {wrongNetwork ? (
        <div className={styles.banner}>
          <span>
            Wrong network detected. EternaVault is configured for {CHAIN_NAME} (chainId {CHAIN_ID}).
          </span>
          <button className={styles.bannerBtn} onClick={ensureChain}>
            Switch to {CHAIN_NAME}
          </button>
        </div>
      ) : null}
      {account ? (
        <span className={styles.connected}>
          <span className={styles.dot} />
          {shortAddr(account)}
        </span>
      ) : (
        <button className={styles.connect} onClick={connect}>
          Connect Wallet
        </button>
      )}
    </>
  );
}
