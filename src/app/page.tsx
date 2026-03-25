import { fetchDapps, fetchGlobalStats, fmtNum, fmt } from "@/lib/api";
import DAppTable from "@/components/DAppTable";
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
      <div className="home-swap-stats" style={{ display: "flex", gap: 16, marginBottom: 28, alignItems: "flex-start" }}>

        {/* Left: Swap widget — wider */}
        <div className="home-swap-widget" style={{ width: 480, flexShrink: 0 }}>
          <SwapWidget />
        </div>

        {/* Right: tight stat pills in 2 columns */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <MiniStat label="Total TVL" value={stats.totalTvl} isCurrency color="#8b5cf6" />
          <MiniStat label="30D Volume" value={stats.totalVolume30d} isCurrency color="#10b981" />
          <MiniStat label="24H Volume" value={stats.totalVolume24h} isCurrency color="#06b6d4" />
          <MiniStat label="Active Users" value={stats.totalActiveUsers24h || 0} color="#ec4899" />
          <MiniStat label="Transactions" value={stats.totalTxCount || 0} color="#3b82f6" />
          <MiniStat label="Active DApps" value={stats.totalDapps || 0} color="#f59e0b" />
          <MiniStat label="Epoch" value={stats.currentEpoch || 0} color="#06b6d4" />
          <MiniStat label="ADA Price" value={adaPrice} isPrice color="#8b5cf6" />
        </div>
      </div>

      {/* DApp Table */}
      <DAppTable dapps={dapps} adaPrice={adaPrice} />
    </main>
  );
}

function MiniStat({ label, value, color, isCurrency, isPrice }: {
  label: string; value: number; color: string;
  isCurrency?: boolean; isPrice?: boolean;
}) {
  let display: string;
  if (isPrice) {
    display = `$${value.toFixed(4)}`;
  } else if (isCurrency) {
    display = fmt(value);
  } else if (value >= 1_000_000) {
    display = `${(value / 1_000_000).toFixed(1)}M`;
  } else if (value >= 1_000) {
    display = `${(value / 1_000).toFixed(1)}K`;
  } else {
    display = value?.toLocaleString() ?? "0";
  }

  return (
    <div className="card" style={{
      padding: "10px 14px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>
        {display}
      </span>
    </div>
  );
}
