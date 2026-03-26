import CustomSwap from "@/components/CustomSwap";
import SwapFAQ from "@/components/SwapFAQ";

const SWAP_FAQS = [
  { q: "How does the Cardano token swap work?", a: "Our swap aggregator routes your trade across 14 Cardano DEXes including Minswap, SundaeSwap, WingRiders, and Splash to find the best rate. Connect any CIP-30 compatible wallet, enter your amount, and the aggregator automatically splits orders across multiple pools for optimal pricing." },
  { q: "What are the fees for swapping?", a: "The aggregator charges a 0.5% fee on each swap. Additionally, each DEX charges its own liquidity provider fee (typically 0.05-0.3%) and Cardano network fees are approximately 0.17 ADA per transaction." },
  { q: "Which wallets are supported?", a: "Any CIP-30 compatible Cardano wallet works with our swap, including Eternl, Nami, Flint, Lace, Typhon, and GeroWallet. Simply click Connect Wallet and select your preferred wallet." },
  { q: "Is the swap non-custodial?", a: "Yes, all swaps are fully non-custodial. Your funds never leave your wallet until you sign the transaction. We never have access to your private keys." },
  { q: "Which DEXes are aggregated?", a: "We aggregate 14 Cardano DEXes: Minswap V1, Minswap V2, Minswap Stable, SundaeSwap, SundaeSwap V3, WingRiders, WingRiders V2, WingRiders Stable, Splash, Splash Stable, VyFinance, CSWAP, MuesliSwap, and Spectrum." },
];

export const metadata = {
  title: "Swap Cardano Tokens — Best Rates Across 14+ DEXes",
  description: "Swap ADA and Cardano native tokens at the best rates. Aggregates Minswap, SundaeSwap, WingRiders and 11 more DEXes with smart order routing.",
  alternates: { canonical: "https://dappsoncardano.com/swap" },
};

export default function SwapPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": SWAP_FAQS.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  };

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
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

      {/* Visible FAQ section */}
      <div style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>
          Frequently Asked Questions
        </h2>
        <SwapFAQ faqs={SWAP_FAQS} />
      </div>
    </main>
  );
}
