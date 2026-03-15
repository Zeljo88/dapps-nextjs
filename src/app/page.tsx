import { fetchDapps, fetchGlobalStats, fmtNum } from "@/lib/api";
import DAppTable from "@/components/DAppTable";
import HomeStats from "@/components/HomeStats";
import { StakeWithAdriaButton } from "@/components/WalletConnect";

export const revalidate = 300;

export default async function HomePage() {
  const [dapps, stats] = await Promise.all([fetchDapps(), fetchGlobalStats()]);
  const adaPrice = stats.adaPrice || 0;

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>

      {/* Hero Banner */}
      <div className="hero-banner">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20 }}>
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8, lineHeight: 1.2 }}>
                Cardano DApp Store
              </h1>
              <p style={{ fontSize: 15, opacity: 0.85, maxWidth: 500 }}>
                Real-time analytics for DApps on Cardano — TVL, volume, transactions and yields.
              </p>
            </div>
            <StakeWithAdriaButton />
          </div>
        </div>
      </div>

      {/* Financial stats — currency-aware */}
      <HomeStats stats={stats} adaPrice={adaPrice} />

      {/* Non-financial stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 36 }}>
        {[
          { label: "Transactions", value: fmtNum(stats.totalTxCount), sub: "Script interactions", color: "#3b82f6" },
          { label: "Active DApps", value: `${stats.totalDapps}`, sub: `${stats.dappsWithTvl} with live TVL`, color: "#f59e0b" },
          { label: "Current Epoch", value: `${stats.currentEpoch}`, sub: `Block #${(stats.blockHeight || 0).toLocaleString()}`, color: "#06b6d4" },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: "16px 22px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* DApp Table */}
      <DAppTable dapps={dapps} adaPrice={adaPrice} />
    </main>
  );
}
