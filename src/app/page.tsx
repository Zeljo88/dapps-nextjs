import { fetchDapps, fetchGlobalStats, fmt, fmtNum } from "@/lib/api";
import StatCard from "@/components/StatCard";
import DAppTable from "@/components/DAppTable";

export const revalidate = 300;

export default async function HomePage() {
  const [dapps, stats] = await Promise.all([fetchDapps(), fetchGlobalStats()]);

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

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 36 }}>
        <StatCard
          label="Total TVL"
          value={fmt(stats.totalTvl)}
          sub="Across all DApps"
          color="#8b5cf6"
          icon="💰"
        />
        <StatCard
          label="30d Volume"
          value={fmt(stats.totalVolume30d)}
          sub="DEX trading volume"
          color="#10b981"
          icon="📊"
        />
        <StatCard
          label="Transactions"
          value={fmtNum(stats.totalTxCount)}
          sub="Script interactions"
          color="#3b82f6"
          icon="⚡"
        />
        <StatCard
          label="DApps Tracked"
          value={`${stats.totalDapps}`}
          sub={`${stats.dappsWithTvl} with TVL data`}
          color="#f59e0b"
          icon="🔧"
        />
        <StatCard
          label="Current Epoch"
          value={`${stats.currentEpoch}`}
          sub={`Block #${(stats.blockHeight || 0).toLocaleString()}`}
          color="#06b6d4"
          icon="🔗"
        />
      </div>

      {/* DApp Table */}
      <DAppTable dapps={dapps} />
    </main>
  );
}
