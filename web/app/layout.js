import "./globals.css";
import Link from "next/link";
import ConnectWallet from "@/components/ConnectWallet";
import styles from "./layout.module.css";

export const metadata = {
  title: "EternaVault — Trustless Inheritance",
  description: "Trustless digital inheritance smart contract on Ethereum.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className={styles.shell}>
          <nav className={styles.nav}>
            <Link href="/" className={styles.brand}>
              <span className={styles.brandIcon} />
              EternaVault
            </Link>
            <div className={styles.links}>
              <Link href="/create" className={styles.link}>
                Create
              </Link>
              <Link href="/my-vault" className={styles.link}>
                My Vaults
              </Link>
              <Link href="/heir" className={styles.link}>
                As Heir
              </Link>
            </div>
            <div className={styles.right}>
              <ConnectWallet />
            </div>
          </nav>
          <main className={styles.main}>{children}</main>
          <footer className={styles.footer}>
            EternaVault · Built for NYU CS-GY 9223 Blockchain &amp; DLT · Spring 2026
          </footer>
        </div>
      </body>
    </html>
  );
}
