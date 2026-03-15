"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { fmt, CATEGORY_COLORS } from "@/lib/api";

const DARK_TOOLTIP = {
  contentStyle: { background: "#16161f", border: "1px solid #2a2a3a", borderRadius: 8, fontSize: 13 },
  labelStyle: { color: "#f1f1f3", fontWeight: 600 },
  itemStyle: { color: "#9999b0" },
};

export default function EcosystemCharts({ eco }: { eco: any }) {
  const tvlData = eco.tvlLeaderboard.slice(0, 12);
  const volData = eco.volumeLeaderboard.slice(0, 8);
  const catData = eco.categoryBreakdown.filter((c: any) => c.count > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* TVL Leaderboard */}
      <div className="card" style={{ padding: 28 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 24 }}>
          TVL by DApp
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={tvlData} margin={{ top: 0, right: 20, bottom: 60, left: 20 }}>
            <XAxis dataKey="name" tick={{ fill: "#9999b0", fontSize: 12 }}
              angle={-40} textAnchor="end" interval={0} />
            <YAxis tickFormatter={(v) => `$${(v/1e6).toFixed(0)}M`}
              tick={{ fill: "#9999b0", fontSize: 12 }} />
            <Tooltip {...DARK_TOOLTIP} formatter={(v: any) => [fmt(v), "TVL"]} />
            <Bar dataKey="tvl" radius={[4, 4, 0, 0]}>
              {tvlData.map((entry: any, i: number) => (
                <Cell key={i} fill={CATEGORY_COLORS[entry.category] || "#8b5cf6"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Volume + Categories row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* DEX Volume */}
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 24 }}>
            30d DEX Volume
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={volData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 80 }}>
              <XAxis type="number" tickFormatter={(v) => `$${(v/1e6).toFixed(0)}M`}
                tick={{ fill: "#9999b0", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#9999b0", fontSize: 12 }} width={80} />
              <Tooltip {...DARK_TOOLTIP} formatter={(v: any) => [fmt(v), "30d Volume"]} />
              <Bar dataKey="volume30d" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category pie */}
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 24 }}>
            DApps by Category
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={catData}
                dataKey="count"
                nameKey="category"
                cx="50%" cy="45%"
                outerRadius={90}
                innerRadius={50}
                paddingAngle={2}
                label={({ name, percent }: any) =>
                  (percent || 0) > 0.05 ? `${String(name).charAt(0) + String(name).slice(1).toLowerCase()} ${((percent || 0) * 100).toFixed(0)}%` : ""
                }
                labelLine={false}
              >
                {catData.map((entry: any, i: number) => (
                  <Cell key={i} fill={CATEGORY_COLORS[entry.category] || "#6b7280"} />
                ))}
              </Pie>
              <Tooltip {...DARK_TOOLTIP} formatter={(v: any, name: any) => [v, name]} />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {catData.slice(0, 8).map((c: any) => (
              <div key={c.category} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: CATEGORY_COLORS[c.category] || "#6b7280" }} />
                <span style={{ color: "var(--text-secondary)" }}>{c.category.charAt(0) + c.category.slice(1).toLowerCase()} ({c.count})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
