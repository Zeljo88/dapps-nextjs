"use client";
import { useCurrency } from "@/lib/currency";

export default function HomeStats({ stats, adaPrice }: { stats: any, adaPrice: number }) {
  const { format } = useCurrency();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
      <StatCard
        label="Total TVL"
        value={format(stats.totalTvl, adaPrice)}
        sub="Across all DApps"
        color="#8b5cf6"
        icon="💰"
      />
      <StatCard
        label="30d Volume"
        value={format(stats.totalVolume30d, adaPrice)}
        sub="DEX trading volume"
        color="#10b981"
        icon="📊"
      />
      <StatCard
        label="24h Volume"
        value={format(stats.totalVolume24h, adaPrice)}
        sub="Last 24 hours"
        color="#06b6d4"
        icon="⚡"
      />
      {stats.totalActiveUsers24h > 0 && (
        <StatCard
          label="Active Users (24h)"
          value={stats.totalActiveUsers24h >= 1000
            ? `${(stats.totalActiveUsers24h / 1000).toFixed(1)}K`
            : `${stats.totalActiveUsers24h}`}
          sub="Unique wallets today"
          color="#ec4899"
          icon="👥"
        />
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color: string; icon?: string;
}) {
  return (
    <div className="card" style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{sub}</div>}
        </div>
        {icon && (
          <div style={{ width: 40, height: 40, borderRadius: 10,
            background: `${color}22`, border: `1px solid ${color}44`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
            {icon}
          </div>
        )}
      </div>
      <div style={{ marginTop: 16, height: 2, background: "var(--border)", borderRadius: 1 }}>
        <div style={{ width: "100%", height: "100%",
          background: `linear-gradient(90deg, ${color}, transparent)`, borderRadius: 1 }} />
      </div>
    </div>
  );
}
