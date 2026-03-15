"use client";
import { useState } from "react";
import { fmt } from "@/lib/api";

export default function DAppTabs({ dapp }: { dapp: any }) {
  const tabs = ["Overview", ...(dapp.hasYields ? ["Yields"] : []), "Scripts"];
  const [active, setActive] = useState("Overview");

  return (
    <div>
      {/* Tab nav */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20,
        borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActive(t)} style={{
            padding: "10px 20px", background: "none",
            border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
            color: active === t ? "var(--accent)" : "var(--text-muted)",
            borderBottom: active === t ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: -1, transition: "all 0.15s",
          }}>{t}</button>
        ))}
      </div>

      {active === "Overview" && <OverviewTab dapp={dapp} />}
      {active === "Yields" && <YieldsTab yields={dapp.yields} />}
      {active === "Scripts" && <ScriptsTab scripts={dapp.scripts} />}
    </div>
  );
}

function OverviewTab({ dapp }: { dapp: any }) {
  const releases = dapp.releases || [];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)",
          textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
          About
        </h3>
        {dapp.description ? (
          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.7 }}>{dapp.description}</p>
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No description available.</p>
        )}
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <InfoRow label="Category" value={dapp.category} />
          {dapp.subCategory && dapp.subCategory !== dapp.category && (
            <InfoRow label="Sub-category" value={dapp.subCategory} />
          )}
          <InfoRow label="Scripts" value={`${dapp.scriptCount} total`} />
          <InfoRow label="Releases" value={`${releases.length} version${releases.length !== 1 ? "s" : ""}`} />
        </div>
      </div>
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)",
          textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
          Versions
        </h3>
        {releases.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No release info.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {releases.map((r: any) => (
              <div key={r.releaseKey} style={{ padding: "12px 16px", background: "var(--bg-secondary)",
                borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>
                  {r.releaseName || `v${r.releaseNumber}`}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Release #{r.releaseNumber}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function YieldsTab({ yields }: { yields: any[] }) {
  if (!yields?.length) return <p style={{ color: "var(--text-muted)" }}>No yield pools.</p>;
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Pool / Symbol", "TVL", "APY", "Base APY", "Reward APY", "Type"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: h === "Pool / Symbol" ? "left" : "right",
                  fontSize: 12, fontWeight: 600, color: "var(--text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yields.map((y, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{y.symbol}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{y.project}</div>
                </td>
                <td style={{ padding: "14px 16px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                  {fmt(y.tvlUsd)}
                </td>
                <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700,
                  color: y.apy > 10 ? "#10b981" : y.apy > 0 ? "#f59e0b" : "var(--text-muted)" }}>
                  {y.apy > 0 ? `${y.apy.toFixed(2)}%` : "—"}
                </td>
                <td style={{ padding: "14px 16px", textAlign: "right", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                  {y.apyBase > 0 ? `${y.apyBase.toFixed(2)}%` : "—"}
                </td>
                <td style={{ padding: "14px 16px", textAlign: "right", color: "#10b981", fontFamily: "monospace" }}>
                  {y.apyReward > 0 ? `${y.apyReward.toFixed(2)}%` : "—"}
                </td>
                <td style={{ padding: "14px 16px", textAlign: "right" }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                    background: y.stablecoin ? "#06b6d420" : "#8b5cf620",
                    color: y.stablecoin ? "#06b6d4" : "#8b5cf6",
                    border: `1px solid ${y.stablecoin ? "#06b6d440" : "#8b5cf640"}`,
                  }}>{y.stablecoin ? "Stable" : "Variable"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScriptsTab({ scripts }: { scripts: any[] }) {
  if (!scripts?.length) return <p style={{ color: "var(--text-muted)" }}>No scripts.</p>;
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Name / Purpose", "Script Hash", "Type", "Tx Count", "Explorer"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: h === "Tx Count" ? "right" : "left",
                  fontSize: 12, fontWeight: 600, color: "var(--text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scripts.map((s, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{s.name || "—"}</div>
                  {s.purpose && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.purpose}</div>
                  )}
                </td>
                <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)" }}>
                  {s.scriptHash ? `${s.scriptHash.slice(0, 16)}...${s.scriptHash.slice(-8)}` : "—"}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {s.plutusVersion && (
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: "#8b5cf620", color: "#a78bfa", border: "1px solid #8b5cf640" }}>
                      {s.plutusVersion}
                    </span>
                  )}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "monospace",
                  color: s.txCount > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {s.txCount > 0 ? s.txCount.toLocaleString() : "—"}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {s.cardanoscanUrl ? (
                    <a href={s.cardanoscanUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none",
                        padding: "3px 10px", borderRadius: 6, border: "1px solid var(--accent-dim)" }}>
                      View ↗
                    </a>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}
