"use client";
import { useState } from "react";
import type { HistoryData } from "@/lib/analytics";

export default function DappHistory({ slug, history }: { slug: string; history: HistoryData }) {
  const [view, setView] = useState<"epoch" | "day">("epoch");
  const rows = view === "epoch"
    ? history.epochs.map(epoch => ({ key: String(epoch.epoch), label: `Epoch ${epoch.epoch}`, count: epoch.dapps.find(d => d.slug === slug)?.transactions ?? 0,
        detail: `${new Date(epoch.startTime * 1000).toLocaleDateString("en-GB", { timeZone: "UTC" })} – ${new Date(epoch.endTime * 1000).toLocaleDateString("en-GB", { timeZone: "UTC" })}`, partial: false }))
    : history.daily.map(day => ({ key: day.date, label: day.date, count: day.dapps.find(d => d.slug === slug)?.transactions ?? 0,
        detail: day.partialDay ? `Partial UTC day · ${(day.coverageSeconds / 3600).toFixed(1)} hours covered` : "Full UTC day", partial: day.partialDay }));
  const maximum = Math.max(1, ...rows.map(row => row.count));
  return <div className="card" style={{ padding: 24 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700 }}>Historical contract activity</h2>
      <div style={{ display: "flex", gap: 6 }}>{(["epoch", "day"] as const).map(period => <button type="button" key={period} onClick={() => setView(period)} aria-pressed={view === period} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: view === period ? "var(--accent-dim)" : "transparent", color: view === period ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontSize: 13 }}>Per {period}</button>)}</div>
    </div>
    <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>Only independently validated, completed epochs are included. Counts cover the published payment scripts, not every protocol action. Daily buckets use UTC; partially covered days are labelled. Live counts above retain their own collection start.</p>
    <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr><th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-muted)" }}>Period</th><th style={{ textAlign: "right", padding: "10px 12px", color: "var(--text-muted)" }}>Observed transactions</th><th style={{ textAlign: "left", padding: "10px 12px", color: "var(--text-muted)" }}>Coverage</th></tr></thead><tbody>{[...rows].reverse().map(row => <tr key={row.key} style={{ borderTop: "1px solid var(--border)" }}><td style={{ padding: "14px 12px", whiteSpace: "nowrap" }}>{row.label}</td><td style={{ padding: "14px 12px", textAlign: "right", minWidth: 150 }}><strong>{row.count.toLocaleString("en-US")}</strong><div aria-hidden="true" style={{ height: 3, marginTop: 7, background: "var(--border)", borderRadius: 4 }}><div style={{ height: "100%", width: `${row.count / maximum * 100}%`, background: "var(--accent)", borderRadius: 4 }} /></div></td><td style={{ padding: "14px 12px", color: row.partial ? "#f59e0b" : "var(--text-secondary)", whiteSpace: "nowrap", fontSize: 12 }}>{row.detail}</td></tr>)}</tbody></table></div>
  </div>;
}
