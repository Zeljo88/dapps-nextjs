import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { CurrencyProvider } from "@/lib/currency";
import { ThemeProvider } from "@/lib/theme";
import { WalletProvider } from "@/lib/wallet";
import { fetchGlobalStats } from "@/lib/api";

const GA_ID = "G-0YSY4YKKD0";

export const metadata: Metadata = {
  title: { default: "DApps on Cardano — Track DApps, TVL, Volume & Yields", template: "%s | DApps on Cardano" },
  description: "Track Cardano DApps with real-time TVL, DEX volume, transaction counts and yield rates. Compare Minswap, Liqwid, SundaeSwap and more — updated every 5 minutes.",
  keywords: ["Cardano", "DApps", "DeFi", "ADA", "TVL", "DEX", "swap", "yield", "analytics", "blockchain"],
  metadataBase: new URL("https://dappsoncardano.com"),
  alternates: { canonical: "https://dappsoncardano.com" },
  openGraph: {
    title: "DApps on Cardano — Track DApps, TVL, Volume & Yields",
    description: "Track Cardano DApps with real-time TVL, DEX volume, transaction counts and yield rates. Compare Minswap, Liqwid, SundaeSwap and more.",
    url: "https://dappsoncardano.com",
    siteName: "DApps on Cardano",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@dappsoncardano",
    creator: "@AdriaStakePool",
    title: "DApps on Cardano — Real-time Cardano DeFi Analytics",
    description: "Track TVL, volume, yields and transactions for Cardano DApps. Updated every 5 minutes.",
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  verification: { google: "9E19dwMDP2glZXbKRGfp8uUmudJvY0boVxV2sZ3h_Fc" },
  manifest: "/manifest.json",
  icons: {
    apple: "/apple-icon",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let adaPrice = 0;
  try { adaPrice = (await fetchGlobalStats()).adaPrice || 0; } catch {}

  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://icons.llama.fi" />
        <link rel="dns-prefetch" href="https://icons.llama.fi" />
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}} />
      </head>
      <body style={{ minHeight: "100vh" }}>
        <ThemeProvider>
          <WalletProvider>
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
                  <a href="https://adriapool.net" target="_blank" rel="noopener noreferrer"
                    style={{ color: "var(--accent)", textDecoration: "none" }}>
                    Powered by ADRIA Pool
                  </a>
                </div>
              </div>
            </footer>
          </CurrencyProvider>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
