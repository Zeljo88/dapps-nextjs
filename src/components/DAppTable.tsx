"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { fmtNum, toSlug, CATEGORY_COLORS } from "@/lib/api";
import CategoryBadge from "./CategoryBadge";
import { useCurrency } from "@/lib/currency";

const CATEGORIES = ["ALL", "DEFI", "MARKETPLACE", "COLLECTION", "GAMING", "COMMUNITY", "STABLECOIN"];

type SortKey = "tvl" | "volume30d" | "trxCount" | "tx24h" | "activeUsers24h" | "name";

export default function DAppTable({ dapps, adaPrice, hideFilters }: { dapps: any[], adaPrice: number, hideFilters?: boolean }) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("tvl");
  const [asc, setAsc] = useState(false);
  const { format } = useCurrency();

  const filtered = useMemo(() => {
    let d = dapps;
    // Hide DApps with no data at all (0 TVL AND 0 tx count AND 0 volume)
    d = d.filter(x => x.tvl > 0 || x.trxCount > 0 || x.volume30d > 0);
    if (search) d = d.filter(x => x.name.toLowerCase().includes(search.toLowerCase()));
    if (cat !== "ALL") d = d.filter(x => x.category === cat);
    d = [...d].sort((a, b) => {
      const av = sort === "name" ? a.name : (a[sort] || 0);
      const bv = sort === "name" ? b.name : (b[sort] || 0);
      if (typeof av === "string") return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      return asc ? av - bv : bv - av;
    });
    return d;
  }, [dapps, search, cat, sort, asc]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc(!asc);
    else { setSort(key); setAsc(false); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span style={{ marginLeft: 4, color: sort === k ? "var(--accent)" : "var(--text-muted)", fontSize: 11 }}>
      {sort === k ? (asc ? "↑" : "↓") : "↕"}
    </span>
  );

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            color: "var(--text-muted)", fontSize: 15 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search DApps..."
            style={{
              width: "100%", paddingLeft: 36, paddingRight: 12, height: 40,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 8, color: "var(--text-primary)", fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        {/* Category filters — hidden on category-specific pages */}
        {!hideFilters && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CATEGORIES.map(c => {
              const color = c === "ALL" ? "#8b5cf6" : (CATEGORY_COLORS[c] || "#6b7280");
              const active = cat === c;
              return (
                <button key={c} onClick={() => setCat(c)} style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", border: "1px solid",
                  background: active ? `${color}20` : "transparent",
                  borderColor: active ? `${color}60` : "var(--border)",
                  color: active ? color : "var(--text-secondary)",
                  transition: "all 0.15s",
                }}>{c === "ALL" ? "All" : c === "COLLECTION" ? "NFT" : c.charAt(0) + c.slice(1).toLowerCase()}</button>
              );
            })}
          </div>
        )}

        <div style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)" }}>
          {filtered.length} DApps
          {search || cat !== "ALL" ? ` of ${dapps.filter(x => x.tvl > 0 || x.trxCount > 0 || x.volume30d > 0).length}` : ""}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={th}>#</th>
                <th style={th} onClick={() => toggleSort("name")} className="cursor-pointer" title="DApp name — click to sort alphabetically">
                  Name <SortIcon k="name" />
                </th>
                <th style={th} title="Primary category: DeFi, NFT, Marketplace, Gaming, etc.">Category</th>
                <th style={{ ...th, textAlign: "right" }} onClick={() => toggleSort("tvl")} className="cursor-pointer" title="Total Value Locked — value of all assets deposited in the DApp's smart contracts">
                  TVL <SortIcon k="tvl" />
                </th>
                <th style={{ ...th, textAlign: "right" }} title="TVL percentage change in the last 24 hours">24h %</th>
                <th style={{ ...th, textAlign: "right" }} onClick={() => toggleSort("volume30d")} className="cursor-pointer" title="Total trading and transaction volume over the last 30 days">
                  30d Volume <SortIcon k="volume30d" />
                </th>
                <th style={{ ...th, textAlign: "right" }} onClick={() => toggleSort("trxCount")} className="cursor-pointer" title="Total on-chain smart contract transactions (script invocations) since launch">
                  Tx Count <SortIcon k="trxCount" />
                </th>
                <th style={{ ...th, textAlign: "right" }} onClick={() => toggleSort("tx24h")} className="cursor-pointer" title="Number of on-chain transactions in the last 24 hours">
                  24h Txs <SortIcon k="tx24h" />
                </th>
                <th style={{ ...th, textAlign: "right" }} onClick={() => toggleSort("activeUsers24h")} className="cursor-pointer" title="Unique wallet addresses (stake keys) that interacted with this DApp in the last 24 hours">
                  Active Users <SortIcon k="activeUsers24h" />
                </th>
                <th style={th} title="External links — website, Twitter, Discord, DeFiLlama">Links</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <tr key={d.id} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ ...td, color: "var(--text-muted)", width: 50 }}>{i + 1}</td>
                  <td style={td}>
                    <Link href={`/dapp/${d.slug ?? toSlug(d.name)}`} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
                      {d.logo ? (
                        <img src={d.logo} alt={d.name} loading="lazy" width={36} height={36}
                          style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
                          onError={(e) => {
                            const img = e.currentTarget;
                            const parent = img.parentElement!;
                            img.style.display = "none";
                            const fb = parent.querySelector(".logo-fallback") as HTMLElement;
                            if (fb) fb.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div className="logo-fallback" style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `${CATEGORY_COLORS[d.category] || "#6b7280"}25`,
                        border: `1px solid ${CATEGORY_COLORS[d.category] || "#6b7280"}35`,
                        display: d.logo ? "none" : "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, fontWeight: 700,
                        color: CATEGORY_COLORS[d.category] || "#6b7280",
                        flexShrink: 0,
                      }}>
                        {d.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.name}</div>
                        {d.subCategory && d.subCategory !== d.category && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{d.subCategory}</div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td style={td}><CategoryBadge category={d.category} /></td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600, fontFamily: "monospace",
                    color: d.tvl > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {d.tvl > 0 ? format(d.tvl, adaPrice) : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace", fontWeight: 600,
                    color: !d.change1d ? "var(--text-muted)" : d.change1d > 0 ? "#10b981" : "#ef4444" }}>
                    {!d.change1d ? "—" : `${d.change1d > 0 ? "▲" : "▼"} ${Math.abs(d.change1d).toFixed(1)}%`}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace",
                    color: d.volume30d > 0 ? "#10b981" : "var(--text-muted)" }}>
                    {d.volume30d > 0 ? format(d.volume30d, adaPrice) : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace",
                    color: d.trxCount > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                    {d.trxCount > 0 ? fmtNum(d.trxCount) : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace",
                    color: d.tx24h > 0 ? "#06b6d4" : "var(--text-muted)" }}>
                    {d.tx24h > 0 ? fmtNum(d.tx24h) : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "monospace",
                    color: d.activeUsers24h > 0 ? "#ec4899" : "var(--text-muted)" }}>
                    {d.activeUsers24h > 0 ? fmtNum(d.activeUsers24h) : "—"}
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {d.audits > 0 && (
                        <a href={d.auditLinks?.[0] || "#"} target="_blank" rel="noopener noreferrer"
                          title={`${d.audits} audit${d.audits > 1 ? "s" : ""}`}
                          style={{ fontSize: 11, color: "#10b981", textDecoration: "none",
                            padding: "3px 8px", borderRadius: 5, border: "1px solid #10b98140",
                            background: "#10b98110", transition: "all 0.15s", whiteSpace: "nowrap" }}
                          onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = "#10b981"; }}
                          onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = "#10b98140"; }}>
                          🛡️
                        </a>
                      )}
                      {d.link && (
                        <a href={d.link} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none",
                            padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)",
                            transition: "all 0.15s" }}
                          onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = "var(--border-light)"; (e.target as HTMLElement).style.color = "var(--text-primary)"; }}
                          onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = "var(--border)"; (e.target as HTMLElement).style.color = "var(--text-muted)"; }}>
                          🌐
                        </a>
                      )}
                      {d.twitter && (
                        <a href={d.twitter} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none",
                            padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)",
                            transition: "all 0.15s" }}
                          onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = "#1d9bf0"; (e.target as HTMLElement).style.color = "#1d9bf0"; }}
                          onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = "var(--border)"; (e.target as HTMLElement).style.color = "var(--text-muted)"; }}>
                          𝕏
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  cursor: "pointer",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "14px 16px",
  verticalAlign: "middle",
};
