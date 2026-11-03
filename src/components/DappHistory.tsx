"use client";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistoryData } from "@/lib/analytics";

function date(value: number) {
  return new Date(value * 1000).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}
type Row = { epoch: number; period: string; transactions: number | null; activeWallets: number | null; orderOutputs: number | null; attributionPercent?: number };

function EpochChart({ rows, metric, label }: { rows: Row[]; metric: "transactions" | "activeWallets" | "orderOutputs"; label: string }) {
  return <div data-testid={metric === "transactions" ? "epoch-activity-chart" : metric === "activeWallets" ? "epoch-wallet-chart" : "epoch-order-chart"} aria-label={`${label} per epoch`} style={{ width: "100%", height: 300, minWidth: 0 }}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={rows} accessibilityLayer margin={{ top: 12, right: 4, bottom: 22, left: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 5" />
        <XAxis dataKey="epoch" padding={{ left: 12, right: 12 }} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval="preserveStartEnd" label={{ value: "Epoch", position: "bottom", fill: "var(--text-muted)", fontSize: 12 }} />
        <YAxis width={46} domain={[0, "auto"]} allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={value => Number(value) >= 1000 ? `${Number(value) / 1000}k` : String(value)} />
        <Tooltip cursor={{ stroke: "var(--text-muted)", strokeDasharray: "3 5" }} contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, maxWidth: 280, whiteSpace: "normal" }} labelStyle={{ color: "var(--text-secondary)", marginBottom: 8 }} itemStyle={{ color: "var(--accent)" }} labelFormatter={(epoch, payload) => {
          const row = payload[0]?.payload as Row | undefined;
          const coverage = metric === "activeWallets" && row?.attributionPercent !== undefined ? ` · ${row.attributionPercent}% of order outputs attributed` : "";
          return `Epoch ${epoch} · ${row?.period ?? ""}${coverage}`;
        }} formatter={value => [Number(value).toLocaleString("en-US"), label]} />
        <Line type="linear" dataKey={metric} name={label} stroke="var(--accent)" strokeWidth={3} dot={{ r: 4, fill: "var(--accent)", strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

export default function DappHistory({ slug, history }: { slug: string; history: HistoryData }) {
  const epochs = [...history.epochs].sort((a, b) => a.epoch - b.epoch);
  if (!epochs.length) return <div className="card" style={{ padding: 24 }}>No validated epochs available yet.</div>;
  const first = epochs[0], last = epochs[epochs.length - 1];
  const rows: Row[] = Array.from({ length: last.epoch - first.epoch + 1 }, (_, index) => {
    const epoch = first.epoch + index;
    const source = epochs.find(item => item.epoch === epoch);
    const dapp = source?.dapps.find(item => item.slug === slug);
    return { epoch, transactions: dapp?.transactions ?? null, activeWallets: dapp?.activeWallets ?? null,
      orderOutputs: dapp?.walletActivity?.candidateOrderOutputs ?? null,
      attributionPercent: dapp?.walletActivity?.attributionPercent,
      period: source ? `${date(source.startTime)} – ${date(source.endTime)} UTC` : "No validated data" };
  });
  const total = rows.reduce((sum, row) => sum + (row.transactions ?? 0), 0);
  const latestWallet = [...rows].reverse().find(row => row.activeWallets !== null);
  const latestOrders = [...rows].reverse().find(row => row.orderOutputs !== null);
  const coverage = rows.flatMap(row => row.attributionPercent === undefined ? [] : [row.attributionPercent]);
  const minimumCoverage = coverage.length ? Math.min(...coverage) : 100;
  const maximumCoverage = coverage.length ? Math.max(...coverage) : 100;
  return <div style={{ display: "grid", gap: 20, minWidth: 0 }}>
    <section className="card" aria-label="Historical activity by epoch" style={{ padding: 24, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
        <div><h2 style={{ fontSize: 16, fontWeight: 700 }}>Activity over time</h2><p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6 }}>Epochs {first.epoch}–{last.epoch} · {date(first.startTime)} – {date(last.endTime)} UTC</p></div>
        <div><strong style={{ fontSize: 24, color: "var(--accent)" }}>{total.toLocaleString("en-US")}</strong><span style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>observed transactions · {epochs.length} validated epochs</span></div>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>Each point represents one completed epoch (about five days). Hover, tap or use the arrow keys to explore its total. Counts cover the tracked contracts; protocol coverage is partial.</p>
      <EpochChart rows={rows} metric="transactions" label="Observed transactions" />
      <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>Only independently validated epochs are shown. Gaps mean data is unavailable. Live counters above use their own collection period.</p>
    </section>
    {latestWallet && <section className="card" aria-label="Active wallets by epoch" style={{ padding: 24, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
        <div><h2 style={{ fontSize: 16, fontWeight: 700 }}>Active wallets over time</h2><p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6 }}>Distinct identifiable order owners per completed epoch</p></div>
        <div><strong style={{ fontSize: 24, color: "var(--accent)" }}>{latestWallet.activeWallets?.toLocaleString("en-US")}</strong><span style={{ display: "block", color: "var(--text-muted)", fontSize: 12 }}>active wallets · epoch {latestWallet.epoch}</span></div>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>Each wallet counts once per epoch when a created order output identifies it as the owner. Orders across tracked contract versions are combined. Hover or tap a point to see attribution coverage.</p>
      {minimumCoverage < 100 && <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>Owner attribution: {minimumCoverage}%–{maximumCoverage}% of tracked order outputs across these epochs. Counts are lower bounds where owners could not be identified.</p>}
      <EpochChart rows={rows} metric="activeWallets" label="Active wallets" />
      <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>Wallets are not people: bots and multiple wallets exist. Addresses sharing an unambiguous observed stake key are grouped where possible. Script-controlled and unidentified orders are excluded. Counts include automatically recreated orders and orders later cancelled; they do not measure all protocol activity. Epoch counts cannot be added together to get unique users across the period.</p>
    </section>}
    {latestOrders && <section className="card" aria-label="Order and request activity by epoch" style={{ padding: 24, minWidth: 0 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700 }}>Order/request activity over time</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, margin: "10px 0 20px" }}>Outputs created at tracked order/request contracts per completed epoch. Includes automatically recreated orders and requests later cancelled or left unfilled. These are not completed swaps or manual visits.</p>
      <EpochChart rows={rows} metric="orderOutputs" label="Order/request outputs created" />
    </section>}
  </div>;
}
