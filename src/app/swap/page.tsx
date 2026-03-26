import CustomSwap from "@/components/CustomSwap";

export const metadata = {
  title: "Swap Cardano Tokens — Best Rates Across 14+ DEXes",
  description: "Swap ADA and Cardano native tokens at the best rates. Aggregates Minswap, SundaeSwap, WingRiders and 11 more DEXes with smart order routing.",
  alternates: { canonical: "https://dappsoncardano.com/swap" },
};

export default function SwapPage() {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          Swap Tokens
        </h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)" }}>
          Best rates across Minswap, SundaeSwap, WingRiders, Splash and more — all in one place.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "480px 1fr", gap: 32, alignItems: "start", justifyContent: "center" }}>

        {/* Swap widget */}
        <div style={{ width: 480 }}>
          <CustomSwap />
        </div>

        {/* Info sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* DEX sources */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)",
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
              Aggregates 14+ DEXes
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Minswap V1", "Minswap V2", "Minswap Stable", "SundaeSwap",
                "SundaeSwap V3", "WingRiders", "WingRiders V2", "WingRiders Stable",
                "Splash", "Splash Stable", "VyFinance", "CSWAP",
                "MuesliSwap", "Spectrum"
              ].map(dex => (
                <span key={dex} style={{
                  padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 500,
                  background: "var(--bg-secondary)", border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}>{dex}</span>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)",
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
              Features
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { icon: "⚡", label: "Best Price Routing", desc: "Automatically finds the best rate across all DEXes" },
                { icon: "🔀", label: "Smart Order Splitting", desc: "Splits your swap across multiple pools for better rates" },
                { icon: "🛡️", label: "Price Impact Warnings", desc: "Get alerted when price impact is too high" },
                { icon: "⚙️", label: "Custom Slippage", desc: "Set your own slippage tolerance (0.5% – 3%)" },
                { icon: "🔒", label: "Non-custodial", desc: "Your keys, your crypto — connect any CIP-30 wallet" },
              ].map(f => (
                <div key={f.label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 20, lineHeight: 1.2 }}>{f.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{f.label}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fee info */}
          <div className="card" style={{ padding: 24, border: "1px solid var(--accent-dim)",
            background: "var(--accent-dim)" }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)",
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Fee breakdown</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Aggregator fee", value: "0.5%", color: "var(--accent)" },
                { label: "DEX liquidity fee", value: "0.05–0.3%", color: "var(--text-secondary)" },
                { label: "Cardano network fee", value: "~0.17 ADA", color: "var(--text-secondary)" },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between",
                  fontSize: 13, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{r.label}</span>
                  <span style={{ fontWeight: 700, color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
              Smart routing ensures you always get the best rate across 14 Cardano DEXes.
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
