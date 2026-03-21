import { fmt } from "@/lib/api";

export const revalidate = 3600;

export const metadata = {
  title: "Cardano Yields",
  description: "Best yield rates on Cardano — APY, TVL and pool data for Liqwid, Indigo, Minswap LP and 90+ more pools.",
  alternates: { canonical: "https://dappsoncardano.com/yields" },
};

async function fetchYields() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://20.79.10.28"}/yields`, { next: { revalidate: 3600 } });
  return res.json();
}

const yieldsJsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": "Cardano DeFi Yield Rates",
  "description": "Best yield rates on Cardano — APY, TVL and pool data for Liqwid, Indigo, Minswap LP and 90+ more pools.",
  "url": "https://dappsoncardano.com/yields",
  "provider": {
    "@type": "Organization",
    "name": "DApps on Cardano",
    "url": "https://dappsoncardano.com",
  },
  "variableMeasured": [
    { "@type": "PropertyValue", "name": "APY", "description": "Annual Percentage Yield" },
    { "@type": "PropertyValue", "name": "TVL", "description": "Total Value Locked in USD" },
    { "@type": "PropertyValue", "name": "Base APY", "description": "Base annual yield rate" },
    { "@type": "PropertyValue", "name": "Reward APY", "description": "Reward token yield rate" },
  ],
  "keywords": ["Cardano", "DeFi", "yield farming", "APY", "liquidity pools", "staking"],
};

export default async function YieldsPage() {
  const yields: any[] = await fetchYields();

  const totalTvl = yields.reduce((s, y) => s + (y.tvlUsd || 0), 0);
  const avgApy = yields.filter(y => y.apy > 0).reduce((s, y) => s + y.apy, 0) / (yields.filter(y => y.apy > 0).length || 1);

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(yieldsJsonLd) }} />
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          Cardano Yields
        </h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)" }}>
          {yields.length} yield pools · {fmt(totalTvl)} total TVL · {avgApy.toFixed(1)}% avg APY
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Pools", value: yields.length.toString(), color: "#8b5cf6" },
          { label: "Total TVL", value: fmt(totalTvl), color: "#10b981" },
          { label: "Avg APY", value: `${avgApy.toFixed(1)}%`, color: "#f59e0b" },
          { label: "High Yield (>10%)", value: yields.filter(y => y.apy > 10).length.toString(), color: "#ef4444" },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: "18px 22px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Yields table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["#", "Protocol", "Pool / Symbol", "TVL", "APY", "Base", "Reward", "Type"].map((h, i) => (
                  <th key={h} style={{ padding: "12px 16px",
                    textAlign: i > 3 ? "right" : "left",
                    fontSize: 12, fontWeight: 600, color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yields.map((y, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 13 }}>{i + 1}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>
                      {y.project?.replace(/-/g, " ")}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text-secondary)",
                      background: "var(--bg-secondary)", padding: "3px 8px", borderRadius: 5,
                      border: "1px solid var(--border)" }}>{y.symbol}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 600 }}>
                    {fmt(y.tvlUsd)}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700,
                    color: y.apy > 15 ? "#ef4444" : y.apy > 5 ? "#10b981" : y.apy > 0 ? "#f59e0b" : "var(--text-muted)" }}>
                    {y.apy > 0 ? `${y.apy.toFixed(2)}%` : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--text-secondary)", fontFamily: "monospace", fontSize: 13 }}>
                    {y.apyBase > 0 ? `${y.apyBase.toFixed(2)}%` : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#10b981", fontFamily: "monospace", fontSize: 13 }}>
                    {y.apyReward > 0 ? `${y.apyReward.toFixed(2)}%` : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: y.stablecoin ? "#06b6d420" : "#8b5cf620",
                      color: y.stablecoin ? "#06b6d4" : "#8b5cf6",
                      border: `1px solid ${y.stablecoin ? "#06b6d440" : "#8b5cf640"}`,
                    }}>{y.stablecoin ? "Stable" : "Variable"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
