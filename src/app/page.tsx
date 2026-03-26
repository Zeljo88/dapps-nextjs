import { fetchDapps, fetchGlobalStats, fmtNum, fmt } from "@/lib/api";
import DAppTable from "@/components/DAppTable";
import StakeButton from "@/components/StakeButton";
import CustomSwap from "@/components/CustomSwap";

export const revalidate = 300;

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://dappsoncardano.com/#website",
      "url": "https://dappsoncardano.com",
      "name": "DApps on Cardano",
      "description": "Real-time analytics for Cardano DApps — TVL, volume, DEX transactions and yield rates. Compare DeFi protocols and swap tokens at best rates.",
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

  // Slim down DApp data for the table — only send fields the client component uses
  // This reduces the RSC payload from ~168KB to ~30KB
  const slimDapps = dapps.map((d: any) => ({
    id: d.id, name: d.name, slug: d.slug, category: d.category, subCategory: d.subCategory,
    tvl: d.tvl, volume30d: d.volume30d, trxCount: d.trxCount, tx24h: d.tx24h,
    activeUsers24h: d.activeUsers24h, change1d: d.change1d, logo: d.logo,
    link: d.link, twitter: d.twitter, audits: d.audits, auditLinks: d.auditLinks,
  }));

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
              Real-time TVL, volume, transactions and yields across the Cardano ecosystem.
            </p>
          </div>
          <StakeButton />
        </div>
      </div>

      {/* Swap + Stats row */}
      <div className="home-swap-stats" style={{ display: "flex", gap: 16, marginBottom: 28, alignItems: "stretch" }}>

        {/* Left: Custom swap */}
        <div className="home-swap-widget" style={{ width: 380, flexShrink: 0 }}>
          <CustomSwap />
        </div>

        {/* Right: tight stat pills in 2 columns, stretch to fill swap height */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignContent: "stretch" }}>
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
      <DAppTable dapps={slimDapps} adaPrice={adaPrice} />
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
      padding: "12px 16px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: "100%", boxSizing: "border-box",
    }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>
        {display}
      </span>
    </div>
  );
}
