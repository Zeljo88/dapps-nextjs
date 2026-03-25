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
      <div className="home-swap-stats" style={{ display: "flex", gap: 20, marginBottom: 28, alignItems: "flex-start" }}>

        {/* Left: Swap widget */}
        <div className="home-swap-widget" style={{ width: 360, flexShrink: 0 }}>
          <SwapWidget />
        </div>

        {/* Right: compact 4-col stats grid — auto height, no stretching */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <MiniStat label="Total TVL" value={stats.totalTvl} isCurrency color="#8b5cf6" icon="💰" />
          <MiniStat label="30D Volume" value={stats.totalVolume30d} isCurrency color="#10b981" icon="📊" />
          <MiniStat label="24H Volume" value={stats.totalVolume24h} isCurrency color="#06b6d4" icon="⚡" />
          <MiniStat label="Active Users" value={stats.totalActiveUsers24h || 0} color="#ec4899" icon="👥" />
          <MiniStat label="Transactions" value={stats.totalTxCount || 0} color="#3b82f6" icon="🔗" />
          <MiniStat label="Active DApps" value={stats.totalDapps || 0} color="#f59e0b" icon="📦" />
          <MiniStat label="Epoch" value={stats.currentEpoch || 0} color="#06b6d4" icon="🧱" />
          <MiniStat label="ADA Price" value={adaPrice} isPrice color="#8b5cf6" icon="₳" />
        </div>
      </div>

      {/* DApp Table */}
      <DAppTable dapps={dapps} adaPrice={adaPrice} />
    </main>
  );
}

function MiniStat({ label, value, color, icon, isCurrency, isPrice }: {
  label: string; value: number; color: string; icon: string;
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
    <div className="card" style={{ padding: "12px 14px", textAlign: "center" }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, margin: "0 auto 6px",
        background: `${color}18`, border: `1px solid ${color}35`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1 }}>
        {display}
      </div>
    </div>
  );
}
