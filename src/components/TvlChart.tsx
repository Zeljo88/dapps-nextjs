"use client";
import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { fetchTvlHistory } from "@/lib/api";

type Point = { date: number; tvl: number };

const RANGES: { label: string; days: number | null }[] = [
  { label: "7D",  days: 7   },
  { label: "30D", days: 30  },
  { label: "90D", days: 90  },
  { label: "1Y",  days: 365 },
  { label: "ALL", days: null },
];

function filterByRange(points: Point[], days: number | null): Point[] {
  if (!days) return points;
  const cutoff = Date.now() / 1000 - days * 86400;
  return points.filter(p => p.date >= cutoff);
}

function fmtTvl(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TvlChart({ slug }: { slug: string }) {
  const [allPoints, setAllPoints] = useState<Point[]>([]);
  const [range, setRange] = useState<number | null>(365);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchTvlHistory(slug)
      .then(d => { setAllPoints(d.points || []); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [slug]);

  const points = filterByRange(allPoints, range);

  if (loading) return (
    <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--text-muted)", fontSize: 14 }}>
      Loading TVL history...
    </div>
  );

  if (error || points.length === 0) return (
    <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--text-muted)", fontSize: 14 }}>
      No TVL history available.
    </div>
  );

  const first = points[0]?.tvl ?? 0;
  const last  = points[points.length - 1]?.tvl ?? 0;
  const trending = last >= first;
  const pct = first > 0 ? ((last - first) / first) * 100 : 0;
  const lineColor = trending ? "#10b981" : "#ef4444";

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>
            {fmtTvl(last)}
          </div>
          <div style={{ fontSize: 13, color: trending ? "#10b981" : "#ef4444",
            fontWeight: 600, marginTop: 4 }}>
            {trending ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% over period
          </div>
        </div>

        {/* Range toggles */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {RANGES.map(r => {
            const active = range === r.days;
            return (
              <button key={r.label} onClick={() => setRange(r.days)} style={{
                padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: "pointer", border: "1px solid",
                background: active ? `${lineColor}20` : "transparent",
                borderColor: active ? `${lineColor}80` : "var(--border)",
                color: active ? lineColor : "var(--text-muted)",
                transition: "all 0.15s",
              }}>{r.label}</button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={points} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={lineColor} stopOpacity={0.28} />
              <stop offset="95%" stopColor={lineColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={fmtTvl}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--text-primary)",
            }}
            labelFormatter={(v: unknown) => fmtDate(v as number)}
            formatter={(v: unknown) => [fmtTvl(v as number), "TVL"]}
          />
          <Area
            type="monotone"
            dataKey="tvl"
            stroke={lineColor}
            strokeWidth={2}
            fill="url(#tvlGrad)"
            dot={false}
            activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
