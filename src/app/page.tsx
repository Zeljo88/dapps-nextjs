import { fetchDapps, fetchGlobalStats, fmtNum } from "@/lib/api";
import DAppTable from "@/components/DAppTable";
import HomeStats from "@/components/HomeStats";

export const revalidate = 300;

export default async function HomePage() {
  const [dapps, stats] = await Promise.all([fetchDapps(), fetchGlobalStats()]);
  const adaPrice = stats.adaPrice || 0;

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      {/* Hero */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          Cardano DApp Analytics
        </h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)", maxWidth: 600 }}>
          Real-time data for {stats.totalDapps} DApps on Cardano — TVL, volume, transactions, and yields.
        </p>
      </div>

      {/* Stats row — client component for currency switching */}
      <HomeStats stats={stats} adaPrice={adaPrice} />

      {/* Epoch/block info row */}
      <div style={{ display: "flex", gap: 20, marginBottom: 36, flexWrap: "wrap" }}>
        {[
          { label: "Transactions", value: fmtNum(stats.totalTxCount), sub: "Script interactions", color: "#3b82f6" },
          { label: "DApps Tracked", value: `${stats.totalDapps}`, sub: `${stats.dappsWithTvl} with TVL data`, color: "#f59e0b" },
          { label: "Current Epoch", value: `${stats.currentEpoch}`, sub: `Block #${(stats.blockHeight || 0).toLocaleString()}`, color: "#06b6d4" },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: "16px 22px", flex: "1 1 180px" }}>
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
