import { fetchEcosystem, fetchGlobalStats, fmt } from "@/lib/api";
import EcosystemCharts from "@/components/EcosystemCharts";

export const revalidate = 300;

export default async function EcosystemPage() {
  const [eco, stats] = await Promise.all([fetchEcosystem(), fetchGlobalStats()]);

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          Cardano Ecosystem
        </h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)" }}>
          {fmt(stats.totalTvl)} TVL · {fmt(stats.totalVolume30d)} 30d volume · Epoch {stats.currentEpoch}
        </p>
      </div>

      <EcosystemCharts eco={eco} />
    </main>
  );
}
