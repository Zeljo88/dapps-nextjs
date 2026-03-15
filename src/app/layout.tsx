import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { CurrencyProvider } from "@/lib/currency";
import { fetchGlobalStats } from "@/lib/api";

export const metadata: Metadata = {
  title: "DApps on Cardano",
  description: "Real-time analytics for Cardano DApps — TVL, volume, transactions and yields.",
  openGraph: {
    title: "DApps on Cardano",
    description: "Real-time analytics for Cardano DApps",
    siteName: "DApps on Cardano",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let adaPrice = 0;
  try { adaPrice = (await fetchGlobalStats()).adaPrice || 0; } catch {}

  return (
    <html lang="en">
      <body style={{ minHeight: "100vh" }}>
        <CurrencyProvider>
          <Navbar adaPrice={adaPrice} />
          {children}
        <footer style={{
          marginTop: 80, padding: "32px 24px",
          borderTop: "1px solid var(--border)",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: 13,
        }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex",
            justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <strong style={{ color: "var(--text-secondary)" }}>DApps on Cardano</strong>
              {" "}· Real-time Cardano DApp analytics
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <span>Data: DeFiLlama · Blockfrost · Koios</span>
              <a href="https://adripool.net" target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--accent)", textDecoration: "none" }}>
                Powered by ADRIA Pool
              </a>
            </div>
          </div>
        </footer>
        </CurrencyProvider>
      </body>
    </html>
  );
}
