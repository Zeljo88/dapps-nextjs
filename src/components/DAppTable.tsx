"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { toSlug, CATEGORY_COLORS } from "@/lib/api";
import CategoryBadge from "./CategoryBadge";
import DappLogo from "./DappLogo";

const CATEGORIES = ["ALL", "DEFI", "MARKETPLACE", "COLLECTION", "GAMING", "COMMUNITY", "STABLECOIN"];

type SortKey = "epochTransactions" | "epochWallets" | "txGrowth" | "walletGrowth" | "attributionPercent" | "name";

interface TableDapp {
  id?: string | number;
  name: string;
  slug?: string;
  category: string;
  subCategory?: string;
  hasRecordedData: boolean;
  epochTransactions: number | null;
  epochWallets: number | null;
  txGrowth: number | null;
  walletGrowth: number | null;
  attributionPercent: number | null;
  logo?: string;
  link?: string;
  twitter?: string;
  audits?: number | null;
  auditLinks?: string[];
  github?: string;
}

type Period = { epoch: number; startTime: number; endTime: number; previousEpoch: number | null };

export default function DAppTable({ dapps, period, hideFilters }: { dapps: TableDapp[], period: Period | null, hideFilters?: boolean }) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("epochTransactions");
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const filtered = useMemo(() => {
    let d = dapps;
    d = d.filter(x => x.hasRecordedData);
    if (search) d = d.filter(x => x.name.toLowerCase().includes(search.toLowerCase()));
    if (cat !== "ALL") d = d.filter(x => x.category === cat);
    d = [...d].sort((a, b) => {
      if (sort === "name") return asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      const av = a[sort];
      const bv = b[sort];
      if (av === null && bv === null) return a.name.localeCompare(b.name);
      if (av === null) return 1;
      if (bv === null) return -1;
      return (asc ? av - bv : bv - av) || a.name.localeCompare(b.name);
    });
    return d;
  }, [dapps, search, cat, sort, asc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const showFrom = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showTo = Math.min(currentPage * PAGE_SIZE, filtered.length);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc(!asc);
    else { setSort(key); setAsc(false); }
  };

  const sortHeader = (label: string, key: SortKey, title: string, left = false) => <th style={{ ...th, textAlign: left ? "left" : "right" }} aria-sort={sort === key ? (asc ? "ascending" : "descending") : "none"} title={title}>
    <button type="button" data-sort={key} onClick={() => toggleSort(key)} aria-label={`Sort by ${label}`} style={{ background: "none", border: 0, padding: 0, color: "inherit", font: "inherit", textTransform: "inherit", letterSpacing: "inherit", cursor: "pointer" }}>
      {label}<SortIcon column={key} sort={sort} ascending={asc} />
    </button>
  </th>;

  return (
    <div>
      <div data-testid="epoch-directory-period" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{period ? `Completed epoch ${period.epoch}` : "Epoch summaries unavailable"}</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, marginTop: 6 }}>
          {period ? `${epochDate(period.startTime)} – ${epochDate(period.endTime)} UTC · ${period.previousEpoch === null ? "Previous consecutive epoch unavailable" : `Growth versus epoch ${period.previousEpoch}`}. All rows use this same completed period.` : "Validated historical figures could not be loaded. Refresh to try again; unavailable values are shown as —."}
        </p>
      </div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            color: "var(--text-muted)", fontSize: 15 }}>🔍</span>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
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
            {CATEGORIES.filter(c => c === "ALL" || dapps.some(d => d.hasRecordedData && d.category === c)).map(c => {
              const color = c === "ALL" ? "#8b5cf6" : (CATEGORY_COLORS[c] || "#6b7280");
              const active = cat === c;
              return (
                <button key={c} onClick={() => { setCat(c); setPage(1); }} style={{
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
          {search || cat !== "ALL" ? ` of ${dapps.filter(x => x.hasRecordedData).length}` : ""}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden", minWidth: 0 }}>
        <div style={{ overflowX: "auto" }} role="region" aria-label="DApp epoch metrics, scroll horizontally for all columns" tabIndex={0}>
          <table data-testid="epoch-directory-table" aria-label={period ? `DApp metrics for epoch ${period.epoch}` : "DApp epoch metrics unavailable"} style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={th}>#</th>
                {sortHeader("Name", "name", "DApp name", true)}
                <th style={th} title="Primary category: DeFi, NFT, Marketplace, Gaming, etc.">Category</th>
                {sortHeader("Transactions / epoch", "epochTransactions", "Validated observed transactions at tracked contracts during the labelled epoch. Partial protocol coverage; not completed trade counts.")}
                {sortHeader("Active wallets / epoch", "epochWallets", "Distinct identifiable order owners during the labelled epoch, including recreated orders. Wallets are not people.")}
                {sortHeader("Tx growth", "txGrowth", "Transaction change versus the immediately preceding validated epoch. A percentage is unavailable when a positive count follows a zero baseline.")}
                {sortHeader("Wallet growth", "walletGrowth", "Wallet-count change versus the immediately preceding validated epoch. Attribution coverage can also affect this change.")}
                {sortHeader("Coverage", "attributionPercent", "Owner attribution: percentage of outputs at tracked order/request scripts with identifiable owners during this epoch. This is not total protocol coverage.")}
                <th style={th} title="External links — website, Twitter, Discord, DeFiLlama">Links</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((d, i) => (
                <tr data-dapp={d.slug} key={d.slug ?? d.id ?? d.name} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ ...td, color: "var(--text-muted)", width: 50 }}>{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                  <td style={td}>
                    <Link href={`/dapp/${d.slug ?? toSlug(d.name)}`} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
                      <DappLogo slug={d.slug ?? toSlug(d.name)} name={d.name} src={d.logo} size={36} />
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.name}</div>
                        {d.subCategory && d.subCategory !== d.category && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{d.subCategory}</div>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td style={td}><CategoryBadge category={d.category} /></td>
                  <td data-metric="transactions" style={{ ...td, textAlign: "right", fontFamily: "monospace" }}>{d.epochTransactions?.toLocaleString("en-US") ?? "—"}</td>
                  <td data-metric="wallets" style={{ ...td, textAlign: "right", fontFamily: "monospace", color: "#ec4899" }}>{d.epochWallets?.toLocaleString("en-US") ?? "—"}</td>
                  <td data-metric="tx-growth" style={{ ...td, textAlign: "right" }}><Growth value={d.txGrowth} /></td>
                  <td data-metric="wallet-growth" style={{ ...td, textAlign: "right" }}><Growth value={d.walletGrowth} /></td>
                  <td data-metric="coverage" style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }} title="Owner attribution within tracked order/request outputs; overall protocol coverage remains partial.">
                    <span style={{ fontFamily: "monospace" }}>{d.attributionPercent === null ? "—" : `${d.attributionPercent.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`}</span>
                    <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>owner attribution</span>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {d.github && (
                        <a href={d.github} target="_blank" rel="noopener noreferrer"
                          title="Open Source"
                          style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none",
                            padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)",
                            transition: "all 0.15s", display: "inline-flex", alignItems: "center" }}
                          onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = "#9ca3af"; (e.target as HTMLElement).style.color = "var(--text-primary)"; }}
                          onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = "var(--border)"; (e.target as HTMLElement).style.color = "var(--text-muted)"; }}>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                          </svg>
                        </a>
                      )}
                      {d.audits != null && d.audits > 0 && (
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
              {paginated.length === 0 && <tr><td colSpan={9} style={{ ...td, color: "var(--text-muted)", textAlign: "center" }}>No DApps with recorded data match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 12 }}>
        Coverage measures identifiable owners among outputs at tracked scripts; protocol coverage remains partial. Wallets are not people, and attribution changes can affect wallet growth. — means unavailable, including missing comparisons or a positive count following a zero baseline. Live counters above use their own collection period. DApps without recorded activity are hidden.
      </p>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 16, padding: "12px 16px", background: "var(--bg-card)",
          border: "1px solid var(--border)", borderRadius: 10, flexWrap: "wrap", gap: 12,
        }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Showing {showFrom}–{showTo} of {filtered.length}
          </span>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              style={paginationBtn(currentPage === 1)}>
              ← Prev
            </button>
            {getPageNumbers(currentPage, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} style={{ padding: "0 6px", color: "var(--text-muted)", fontSize: 13 }}>…</span>
              ) : (
                <button key={p} onClick={() => setPage(p as number)}
                  style={{
                    ...paginationBtn(false),
                    background: currentPage === p ? "var(--accent)" : "transparent",
                    color: currentPage === p ? "#fff" : "var(--text-secondary)",
                    borderColor: currentPage === p ? "var(--accent)" : "var(--border)",
                    fontWeight: currentPage === p ? 700 : 500,
                  }}>
                  {p}
                </button>
              )
            )}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              style={paginationBtn(currentPage === totalPages)}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function epochDate(value: number) {
  return new Date(value * 1000).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}

function Growth({ value }: { value: number | null }) {
  if (value === null) return <span title="Comparable data unavailable, or the previous count is zero." style={{ color: "var(--text-muted)" }}>—</span>;
  const small = value !== 0 && Math.abs(value) < 0.05;
  const text = value === 0 ? "0.0%" : `${value > 0 ? "+" : "−"}${small ? "<0.1" : Math.abs(value).toFixed(1)}%`;
  return <span style={{ fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap", color: value > 0 ? "#10b981" : value < 0 ? "#ef4444" : "var(--text-muted)" }} title={`${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}% versus the previous consecutive epoch`}>{text}</span>;
}

function SortIcon({ column, sort, ascending }: { column: SortKey; sort: SortKey; ascending: boolean }) {
  return (
    <span style={{ marginLeft: 4, color: sort === column ? "var(--accent)" : "var(--text-muted)", fontSize: 11 }}>
      {sort === column ? (ascending ? "↑" : "↓") : "↕"}
    </span>
  );
}

function paginationBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 6, fontSize: 13, fontWeight: 500,
    cursor: disabled ? "default" : "pointer",
    border: "1px solid var(--border)",
    background: "transparent",
    color: disabled ? "var(--text-muted)" : "var(--text-secondary)",
    opacity: disabled ? 0.5 : 1,
    transition: "all 0.15s",
  };
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
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
