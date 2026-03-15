import SwapWidget from "@/components/SwapWidget";

export const metadata = {
  title: "Swap | DApps on Cardano",
  description: "Swap Cardano tokens at the best rates across all DEXes — powered by DexHunter.",
};

export default function SwapPage() {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          Swap Tokens
        </h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)" }}>
          Best rates across Minswap, SundaeSwap, WingRiders, Splash and more — all in one place.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "450px 1fr", gap: 32, alignItems: "start" }}>

        {/* Swap widget */}
        <SwapWidget />

        {/* Info sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* DEX sources */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)",
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
              Aggregates 14+ DEXes
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Minswap V1", "Minswap V2", "SundaeSwap V1", "SundaeSwap V3",
                "WingRiders", "WingRiders V2", "Splash", "VyFinance",
                "CSWAP", "MuesliSwap", "ChadSwap", "SnekFun", "Chakra", "Shadow Book"
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
                { icon: "🔀", label: "Split Orders", desc: "Splits your swap across multiple pools for better rates" },
                { icon: "📋", label: "Limit Orders", desc: "Set a target price and execute automatically" },
                { icon: "🔁", label: "DCA", desc: "Dollar-cost average into any token on a schedule" },
                { icon: "🔒", label: "Non-custodial", desc: "Your keys, your crypto — always" },
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
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              <span style={{ fontWeight: 700, color: "var(--accent)" }}>Zero platform fee</span>
              {" "}— you only pay the standard DEX fee (0.3% or less). Powered by{" "}
              <a href="https://dexhunter.io" target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--accent)", textDecoration: "none" }}>DexHunter</a>.
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
