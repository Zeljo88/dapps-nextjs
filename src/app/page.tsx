import { fetchDapps, fetchGlobalStats, fmtNum } from "@/lib/api";
import DAppTable from "@/components/DAppTable";
import HomeStats from "@/components/HomeStats";
import StakeButton from "@/components/StakeButton";
import SwapWidget from "@/components/SwapWidget";
import "@dexhunterio/swaps/lib/assets/style.css";

export const revalidate = 300;

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://dappsoncardano.com/#website",
      "url": "https://dappsoncardano.com",
      "name": "DApps on Cardano",
      "description": "Real-time analytics for 107 Cardano DApps — TVL, volume, DEX transactions and yield rates. Compare DeFi protocols and swap tokens at best rates.",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://dappsoncardano.com/?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": "https://dappsoncardano.com/#organization",
      "name": "DApps on Cardano",
      "url": "https://dappsoncardano.com",
      "sameAs": ["https://twitter.com/dappsoncardano"],
    },
  ],
};

export default async function HomePage() {
  const [dapps, stats] = await Promise.all([fetchDapps(), fetchGlobalStats()]);
  const adaPrice = stats.adaPrice || 0;

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />

      {/* Compact Hero Banner */}
      <div className="hero-banner" style={{ padding: "18px 28px" }}>
        <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, lineHeight: 1.2 }}>
              Cardano DApps Analytics
            </h1>
            <p style={{ fontSize: 14, opacity: 0.85, maxWidth: 500 }}>
              Real-time TVL, volume, transactions and yields for 107 DApps.
            </p>
          </div>
          <StakeButton />
        </div>
      </div>

      {/* Swap + Stats row */}
      <div className="home-swap-stats" style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, marginBottom: 28, alignItems: "start" }}>

        {/* Left: Swap widget */}
        <div className="home-swap-widget">
          <SwapWidget />
        </div>

        {/* Right: Stats grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <HomeStats stats={stats} adaPrice={adaPrice} compact />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              { label: "Transactions", value: fmtNum(stats.totalTxCount), sub: "Script interactions", color: "#3b82f6" },
              { label: "Active DApps", value: `${stats.totalDapps}`, sub: `${stats.dappsWithTvl} with live TVL`, color: "#f59e0b" },
              { label: "Current Epoch", value: `${stats.currentEpoch}`, sub: `Block #${(stats.blockHeight || 0).toLocaleString()}`, color: "#06b6d4" },
            ].map(c => (
              <div key={c.label} className="card" style={{ padding: "12px 16px" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DApp Table */}
      <DAppTable dapps={dapps} adaPrice={adaPrice} />
    </main>
  );
}
