"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Globe, Info } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/api";
import type { tableDapp } from "@/lib/dapp-view";
import type { directoryPeriod } from "@/lib/epoch-summary";
import type { EpochTvl } from "@/lib/tvl-summary";
import CategoryBadge from "./CategoryBadge";
import DappLogo from "./DappLogo";
import MetricTooltip from "./MetricTooltip";

type TableDapp = ReturnType<typeof tableDapp>;
type Period = ReturnType<typeof directoryPeriod>;
type SortKey = "epochTransactions" | "epochWallets" | "tvl" | "name";
const CATEGORIES = ["ALL", "DEFI", "MARKETPLACE", "COLLECTION", "GAMING", "COMMUNITY", "STABLECOIN"];
const TRANSACTIONS = "Successful transactions that create or spend outputs at this DApp’s tracked contracts during the completed epoch. Each transaction counts once per DApp. Includes orders, cancellations, liquidity actions and batch settlements; this is not a count of completed swaps.";
const WALLETS = "Distinct identifiable order owners during the completed epoch, counted once across the tracked versions of each DApp. Includes automatically recreated and later-cancelled orders. Wallets are not people or completed traders. Owners we cannot identify are excluded.";
const TVL = "Total Value Locked: estimated US-dollar value of deposited assets, using the latest DefiLlama Cardano snapshot at or before this epoch’s end, at most 24 hours earlier. This is a balance at one moment. Prices, deposits and withdrawals can change it. Provider coverage can differ from our tracked contracts; separate staking, borrowed and pool2 series are excluded.";
const SCOPES: Record<string, string> = {
  minswap: "Transactions and wallets cover registered Minswap V1, V2 and stableswap contracts. Farming, staking, governance and launch-event contracts are excluded. Wallets use identifiable order-owner keys, grouping unambiguous observed stake links where possible.",
  sundaeswap: "Transactions and wallets cover registered SundaeSwap V1 escrow, V3, V4 and stableswap contracts. Wallets count single-signature order-owner authorization keys. Complex multisignature and script-controlled owners are excluded.",
  wingriders: "Transactions and wallets cover registered WingRiders V1 constant-product and stableswap request contracts. V2, pool-only, farming and governance activity are outside this coverage. Wallets count identifiable request-owner keys, not arbitrary beneficiaries.",
};

export default function DAppTable({ dapps, period, hideFilters }: { dapps: TableDapp[]; period: Period; hideFilters?: boolean }) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("epochTransactions");
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const filtered = useMemo(() => {
    const rows = dapps.filter(d => d.hasRecordedData && (!search || d.name.toLowerCase().includes(search.toLowerCase())) && (cat === "ALL" || d.category === cat));
    return rows.sort((a, b) => {
      if (sort === "name") return (asc ? 1 : -1) * a.name.localeCompare(b.name);
      const av = sort === "tvl" ? a.tvl?.current?.usd ?? null : a[sort];
      const bv = sort === "tvl" ? b.tvl?.current?.usd ?? null : b[sort];
      if (av === null && bv === null) return a.name.localeCompare(b.name);
      if (av === null) return 1;
      if (bv === null) return -1;
      return (asc ? av - bv : bv - av) || a.name.localeCompare(b.name);
    });
  }, [dapps, search, cat, sort, asc]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const toggleSort = (key: SortKey) => { if (sort === key) setAsc(!asc); else { setSort(key); setAsc(false); } setPage(1); };
  const sortHeader = (label: string, key: SortKey, help?: string) => <th scope="col" aria-sort={sort === key ? (asc ? "ascending" : "descending") : "none"}>
    <div className="epoch-column-heading"><button type="button" data-sort={key} className="epoch-sort" onClick={() => toggleSort(key)} aria-label={`Sort by ${label}`}>
      {label}<span aria-hidden="true">{sort === key ? (asc ? " ↑" : " ↓") : " ↕"}</span>
    </button>{help && <MetricTooltip label={`About ${label}`} text={help} />}</div>
  </th>;
  const epochLabel = period.completedEpoch === null ? "Unavailable" : String(period.completedEpoch);
  return <section className="epoch-directory" aria-label="Completed-epoch DApp activity">
    <div data-testid="epoch-directory-period" className="card epoch-period">
      <div><div className="epoch-period-heading"><h2>Latest validated completed epoch · {epochLabel}</h2>
        <MetricTooltip label="About the reporting epoch" text={period.startTime !== null && period.endTime !== null
          ? `Transactions and wallets cover epoch ${epochLabel}: ${utcTime(period.startTime)} to ${utcTime(period.endTime)}. The unfinished epoch is excluded. On refresh, we use the latest completed epoch that has passed validation. TVL uses a daily snapshot near this epoch’s end, with its exact time shown separately.`
          : "Validated completed-epoch history is temporarily unavailable. Missing metrics are shown as a dash; partial live counts are not substituted."} /></div>
        <p>{period.startTime !== null && period.endTime !== null ? `${epochDate(period.startTime)} – ${epochDate(period.endTime)} · UTC · 5 days` : "Completed history unavailable"}</p></div>
      <div data-testid="growth-period"><strong>{period.previousEpoch !== null ? `Changes: ${epochLabel} compared with ${period.previousEpoch}` : "Previous-epoch comparison unavailable"}</strong><p>{period.previousEpoch !== null ? "Two completed 5-day epochs" : "Missing comparisons are shown as —"}</p></div>
    </div>
    <div className="epoch-toolbar">
      <input aria-label="Search DApps" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search DApps..." />
      {!hideFilters && <div className="epoch-filters">{CATEGORIES.filter(c => c === "ALL" || dapps.some(d => d.hasRecordedData && d.category === c)).map(c => {
        const color = c === "ALL" ? "var(--accent)" : CATEGORY_COLORS[c] || "var(--text-secondary)";
        return <button type="button" key={c} aria-pressed={cat === c} onClick={() => { setCat(c); setPage(1); }} style={{ color, background: cat === c ? "var(--accent-dim)" : "transparent" }}>{c === "ALL" ? "All" : c === "COLLECTION" ? "NFT" : c.charAt(0) + c.slice(1).toLowerCase()}</button>;
      })}</div>}
      <span aria-live="polite">{filtered.length} DApps</span>
    </div>
    <div className="card epoch-table-wrap"><table data-testid="epoch-directory-table" className="epoch-table" aria-label={`DApp totals for completed epoch ${epochLabel}, changes versus ${period.previousEpoch ?? "unavailable"}`}>
      <thead><tr>{sortHeader("DApp", "name")}{sortHeader("Transactions", "epochTransactions", TRANSACTIONS)}{sortHeader("Active wallets", "epochWallets", WALLETS)}{sortHeader("TVL · near epoch end", "tvl", TVL)}<th scope="col">Links</th></tr></thead>
      <tbody>{rows.map((d, index) => <tr data-dapp={d.slug} key={d.slug}>
        <th scope="row" className="epoch-dapp-cell"><div className="epoch-dapp-name"><span className="epoch-rank">{(currentPage - 1) * pageSize + index + 1}</span>
          <Link href={`/dapp/${d.slug}`}><DappLogo slug={d.slug} name={d.name} src={d.logo} size={36} /><div><strong>{d.name}</strong><span className="epoch-category"><CategoryBadge category={d.category} /></span></div></Link>
          <MetricTooltip label={`Coverage for ${d.name}`} text={SCOPES[d.slug] ?? "Activity covers this DApp’s published tracked contracts only. See its profile for the contract list and methodology."} />
        </div></th>
        <td data-metric="transactions"><div className="epoch-mobile-label">Transactions <MetricTooltip label={`About ${d.name} transactions`} text={TRANSACTIONS} /></div><strong className="epoch-value">{number(d.epochTransactions)}</strong>
          <Growth name={d.name} metric="transactions" current={d.epochTransactions} previous={d.previousTransactions} value={d.txGrowth} period={period} />
          <span className="epoch-previous">Previous: {number(d.previousTransactions)}</span></td>
        <td data-metric="wallets"><div className="epoch-mobile-label">Active wallets <MetricTooltip label={`About ${d.name} active wallets`} text={WALLETS} /></div><strong className="epoch-value">{number(d.epochWallets)}</strong>
          <Growth name={d.name} metric="active wallets" current={d.epochWallets} previous={d.previousWallets} value={d.walletGrowth} period={period} extra={d.attributionPercent !== null ? ` Owners were identifiable in ${d.attributionPercent}% of tracked order/request outputs in the reporting epoch. This does not measure whole-protocol coverage.` : ""} />
          <span className="epoch-previous">Previous: {number(d.previousWallets)}</span></td>
        <td data-metric="tvl"><div className="epoch-mobile-label">TVL · near epoch end <MetricTooltip label={`About ${d.name} TVL`} text={TVL} /></div><TvlCell name={d.name} tvl={d.tvl} epoch={period.completedEpoch} /></td>
        <td className="epoch-links">{d.link && <a href={d.link} target="_blank" rel="noopener noreferrer" aria-label={`${d.name} website`}><Globe size={16} aria-hidden="true" /></a>}</td>
      </tr>)}{!rows.length && <tr><td colSpan={5} className="epoch-empty">No DApps with recorded data match these filters.</td></tr>}</tbody>
    </table></div>
    <p className="epoch-footnote">Transactions and wallets cover tracked contracts only. Wallets are identifiable order owners, not people. TVL is a separate DefiLlama estimate with its own protocol coverage. — means unavailable.</p>
    {totalPages > 1 && <nav className="epoch-pagination" aria-label="DApp pages"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>← Previous</button><span>Page {currentPage} of {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next →</button></nav>}
  </section>;
}

function Growth({ name, metric, current, previous, value, period, extra = "" }: { name: string; metric: string; current: number | null; previous: number | null; value: number | null; period: Period; extra?: string }) {
  const change = current !== null && previous !== null ? current - previous : null;
  const explanation = `${name} ${metric}: ${number(current)} in epoch ${period.completedEpoch ?? "unavailable"} versus ${number(previous)} in epoch ${period.previousEpoch ?? "unavailable"}. ${change !== null ? `${number(Math.abs(change))} ${change < 0 ? "fewer" : "more"}. ` : ""}${value === null ? "A percentage is unavailable when a count is missing or the previous count is zero." : "The percentage compares these two completed epochs using unrounded totals."}${extra}`;
  const text = value === null ? "—" : value === 0 ? "0.0%" : `${value > 0 ? "+" : "−"}${Math.abs(value) < 0.05 ? "<0.1" : Math.abs(value).toFixed(1)}%`;
  return <div className="epoch-growth" data-metric={metric === "transactions" ? "tx-growth" : "wallet-growth"} style={{ color: value === null || value === 0 ? "var(--text-secondary)" : value > 0 ? "var(--green)" : "var(--red)" }}><MetricTooltip text={explanation} label={`${name} ${metric} change`}>
    {text}{period.previousEpoch !== null ? ` vs ${period.previousEpoch}` : ""}<Info size={13} aria-hidden="true" />
  </MetricTooltip></div>;
}

function TvlCell({ name, tvl, epoch }: { name: string; tvl: EpochTvl | null; epoch: number | null }) {
  const snapshot = tvl?.current;
  if (!snapshot) return <div><MetricTooltip label={`${name} TVL unavailable`} text="A verified DefiLlama Cardano TVL snapshot within 24 hours before this epoch’s end is unavailable. A dash means unknown, not zero."><strong className="epoch-value">—</strong><Info size={14} aria-hidden="true" /></MetricTooltip><span className="epoch-previous">Unavailable</span></div>;
  const age = snapshot.epochEnd - snapshot.observedAt;
  const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(snapshot.usd);
  const detail = `${name} TVL for epoch ${epoch}: ${snapshot.usd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })}. Source: DefiLlama, ${tvl.scope}. Observed ${utcTime(snapshot.observedAt)}, ${Math.floor(age / 3600)}h ${Math.floor(age % 3600 / 60)}m before the epoch ended. This daily snapshot approximates the end-of-epoch balance; it is not an exact epoch-boundary measurement or a five-day sum. USD changes also reflect token prices. Provider coverage differs from our transaction and wallet scripts; separate staking, borrowed and pool2 series are excluded.`;
  return <div><MetricTooltip label={`${name} TVL snapshot details`} text={detail}><strong className="epoch-value">{age ? "≈ " : ""}{usd}</strong><Info size={14} aria-hidden="true" /></MetricTooltip>
    <span className="epoch-previous">{age ? `~${Math.round(age / 3600)}h before epoch end` : "At epoch end"}</span></div>;
}
function number(value: number | null) { return value === null ? "—" : value.toLocaleString("en-US"); }
function epochDate(value: number) { return new Date(value * 1000).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }); }
function utcTime(value: number) { return new Date(value * 1000).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "medium" }) + " UTC"; }
