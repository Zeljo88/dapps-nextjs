"use client";
import { useState } from "react";
import type { HistoryData, TrackedDapp } from "@/lib/analytics";

function time(value: number | null) {
  return value === null ? "Unavailable" : new Date(value * 1000).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";
}
import DappHistory from "./DappHistory";
const heading = { fontSize: 14, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 16 };

export default function TrackedDappTabs({ dapp, history }: { dapp: TrackedDapp; history: HistoryData | null }) {
  const [active, setActive] = useState("Overview");
  return <div>
    <div role="tablist" aria-label="DApp details" style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
      {["Overview", ...(history?.epochs.length ? ["History"] : []), "Scripts"].map(tab => <button key={tab} type="button" role="tab" id={`tab-${tab}`} aria-selected={active === tab} aria-controls={`panel-${tab}`} onClick={() => setActive(tab)} style={{ padding: "10px 20px", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: active === tab ? "var(--accent)" : "var(--text-muted)", borderBottom: active === tab ? "2px solid var(--accent)" : "2px solid transparent", whiteSpace: "nowrap" }}>{tab}</button>)}
    </div>
    <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
      {active === "History" && history && <DappHistory slug={dapp.slug} history={history} />}
      {active === "Overview" && <div className="dapp-overview-grid">
        <div className="card" style={{ padding: 24 }}><h2 style={heading}>About</h2><p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.7 }}>{dapp.description}</p>
          <div style={{ marginTop: 20, display: "grid", gap: 12, fontSize: 13 }}><p>Category: {dapp.category}</p><p>Tracked scripts: {dapp.scripts.length}</p><p>Last observed activity: {time(dapp.lastObservedActivity)}</p></div>
        </div>
        <div className="card" style={{ padding: 24 }}><h2 style={heading}>Tracked versions & coverage</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>{[...new Set(dapp.scripts.map(script => script.role.split(" ")[0]))].map(version => <span key={version} style={{ padding: "4px 10px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)", fontSize: 13 }}>{version}</span>)}</div>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.8 }}>Partial tracked-contract coverage. Recording since {time(dapp.recordedSince)}. These counts are observations, not complete protocol totals or completed trades.</p>
          <p style={{ marginTop: 14, fontSize: 13 }}><a href={dapp.sourceDocumentation || dapp.source} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Contract mapping source ↗</a></p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>Mapping reviewed {dapp.mappingReviewedOn ?? "—"}. TVL, volume, users and prices are unavailable.</p>
        </div>
      </div>}
      {active === "Scripts" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>{dapp.scripts.map(script => <div className="card" key={script.hash} style={{ padding: 20, minWidth: 0 }}><h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{script.role}</h2><code style={{ display: "block", overflowWrap: "anywhere", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8 }}>{script.hash}</code><a href={`https://cardanoscan.io/script/${script.hash}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 14, color: "var(--accent)", fontSize: 12 }}>View script on Cardanoscan ↗</a></div>)}</div>}

    </div>
  </div>;
}
