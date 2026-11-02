import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { CurrencyProvider } from "@/lib/currency";
import { ThemeProvider } from "@/lib/theme";
import { WalletProvider } from "@/lib/wallet";

const GA_ID = "G-0YSY4YKKD0";

export const metadata: Metadata = {
  title: { default: "DApps on Cardano — Observed Contract Activity", template: "%s | DApps on Cardano" },
  description: "Explore observed Cardano DApp contract activity from our own mainnet node, with published script mappings, collection dates and transaction evidence.",
  keywords: ["Cardano", "DApps", "DeFi", "ADA", "TVL", "DEX", "swap", "yield", "analytics", "blockchain"],
  metadataBase: new URL("https://dappsoncardano.com"),
  openGraph: {
    title: "DApps on Cardano — Observed Contract Activity",
    description: "Explore Cardano contract activity with transparent coverage and transaction evidence.",
    url: "https://dappsoncardano.com",
    siteName: "DApps on Cardano",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@dappsoncardano",
    title: "DApps on Cardano — Real-time Cardano DeFi Analytics",
    description: "Observe Cardano DApp contract activity with transparent coverage and transaction evidence.",
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  verification: { google: "9E19dwMDP2glZXbKRGfp8uUmudJvY0boVxV2sZ3h_Fc" },
  manifest: "/manifest.json",
  icons: {
    apple: "/apple-icon",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const adaPrice = 0;

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
                  <a href="/methodology">Data: our Cardano node · Coverage & methodology</a>
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
