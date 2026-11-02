"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistoryData } from "@/lib/analytics";
function date(value: number) {
  return new Date(value * 1000).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}
export default function DappHistory({ slug, history }: { slug: string; history: HistoryData }) {
  const epochs = [...history.epochs].sort((a, b) => a.epoch - b.epoch);
  if (!epochs.length) return <div className="card" style={{ padding: 24 }}>No validated epochs available yet.</div>;
  const first = epochs[0], last = epochs[epochs.length - 1];
  const rows = Array.from({ length: last.epoch - first.epoch + 1 }, (_, index) => {
    const epoch = first.epoch + index;
    const source = epochs.find(item => item.epoch === epoch);
    return { epoch, transactions: source?.dapps.find(dapp => dapp.slug === slug)?.transactions ?? null,
      period: source ? `${date(source.startTime)} – ${date(source.endTime)} UTC` : "No validated data" };
  });
  const total = rows.reduce((sum, row) => sum + (row.transactions ?? 0), 0);
  return <section className="card" aria-label="Historical activity by epoch" style={{ padding: 24, minWidth: 0 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
      <div><h2 style={{ fontSize: 16, fontWeight: 700 }}>Activity over time</h2><p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6 }}>Epochs {first.epoch}–{last.epoch} · {date(first.startTime)} – {date(last.endTime)} UTC</p></div>
      <div><strong style={{ fontSize: 24, color: "var(--accent)" }}>{total.toLocaleString("en-US")}</strong><span style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>observed transactions · {epochs.length} validated epochs</span></div>
    </div>
    <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>Each bar represents one completed epoch (about five days). Hover, tap or use the arrow keys to explore its total. Counts cover the tracked contracts; protocol coverage is partial.</p>
    <div data-testid="epoch-activity-chart" style={{ width: "100%", height: 300, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={rows} accessibilityLayer margin={{ top: 12, right: 4, bottom: 22, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 5" />
          <XAxis dataKey="epoch" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval="preserveStartEnd" label={{ value: "Epoch", position: "bottom", fill: "var(--text-muted)", fontSize: 12 }} />
          <YAxis width={46} domain={[0, "auto"]} allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={value => Number(value) >= 1000 ? `${Number(value) / 1000}k` : String(value)} />
          <Tooltip cursor={{ fill: "var(--accent-dim)" }} contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "var(--text-secondary)", marginBottom: 8 }} itemStyle={{ color: "var(--accent)" }} labelFormatter={(label, payload) => `Epoch ${label} · ${payload[0]?.payload.period ?? ""}`} formatter={value => [Number(value).toLocaleString("en-US"), "Observed transactions"]} />
          <Bar dataKey="transactions" name="Observed transactions" fill="var(--accent)" radius={[5, 5, 0, 0]} maxBarSize={60} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>Only independently validated epochs are shown. Gaps mean data is unavailable. Live counters above use their own collection period.</p>
  </section>;
}
