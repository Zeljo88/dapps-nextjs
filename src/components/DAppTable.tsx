"use client";
import { useState, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { Globe, Info } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/api";
import type { tableDapp } from "@/lib/dapp-view";
import type { directoryPeriod } from "@/lib/epoch-summary";
import type { EpochTvl } from "@/lib/tvl-summary";
import { listedTvlTotal } from "@/lib/tvl-summary";
import { viewDapp, type DirectoryView } from "@/lib/directory-view";
import CategoryBadge from "./CategoryBadge";
import DappLogo from "./DappLogo";
import MetricTooltip from "./MetricTooltip";
import CompactStat from "./CompactStat";

type TableDapp = ReturnType<typeof tableDapp>;
type Period = ReturnType<typeof directoryPeriod>;
type SortKey = "epochTransactions" | "epochWallets" | "tvl" | "name";
const CATEGORIES = ["ALL", "DEFI", "MARKETPLACE", "COLLECTION", "GAMING", "COMMUNITY", "STABLECOIN"];
const TRANSACTIONS = "Successful transactions that create or spend outputs at this DApp’s tracked contracts during the selected reporting period. Each transaction counts once per DApp. Includes orders, cancellations, liquidity actions and batch settlements; this is not a count of completed swaps.";
const WALLETS = "Distinct identifiable order owners per completed epoch, counted once across the tracked versions of each DApp. Includes automatically recreated and later-cancelled orders. Wallets are not people or completed traders. Owners we cannot identify are excluded.";
const TVL = "Total Value Locked: estimated US-dollar value of deposited assets, using the latest DefiLlama Cardano snapshot at or before the reporting period’s end, at most 24 hours earlier. This is a balance at one moment. Prices, deposits and withdrawals can change it. Provider coverage can differ from our tracked contracts; separate staking, borrowed and pool2 series are excluded.";
const SCOPES: Record<string, string> = {
  minswap: "Transactions and wallets cover registered Minswap V1, V2 and stableswap contracts. Farming, staking, governance and launch-event contracts are excluded. Wallets use identifiable order-owner keys, grouping unambiguous observed stake links where possible.",
  sundaeswap: "Transactions and wallets cover registered SundaeSwap V1 escrow, V3, V4 and stableswap contracts. Wallets count single-signature order-owner authorization keys. Complex multisignature and script-controlled owners are excluded.",
  wingriders: "Transactions and wallets cover registered WingRiders V1 constant-product and stableswap request contracts. V2, pool-only, farming and governance activity are outside this coverage. Wallets count identifiable request-owner keys, not arbitrary beneficiaries.",
};

export default function DAppTable({ dapps, period, hideFilters, swap, notice }: { dapps: TableDapp[]; period: Period; hideFilters?: boolean; swap?: ReactNode; notice?: ReactNode }) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("epochTransactions");
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<DirectoryView>("completed");
  const pageSize = 25;
  const displayed = useMemo(() => dapps.map(dapp => viewDapp(dapp, view, period)), [dapps, view, period]);
  const filtered = useMemo(() => {
    const rows = displayed.filter(d => d.hasRecordedData && (!search || d.name.toLowerCase().includes(search.toLowerCase())) && (cat === "ALL" || d.category === cat));
    return rows.sort((a, b) => {
      if (sort === "name") return (asc ? 1 : -1) * a.name.localeCompare(b.name);
      const av = sort === "tvl" ? a.tvl?.current?.usd ?? null : a[sort];
      const bv = sort === "tvl" ? b.tvl?.current?.usd ?? null : b[sort];
      if (av === null && bv === null) return a.name.localeCompare(b.name);
      if (av === null) return 1;
      if (bv === null) return -1;
      return (asc ? av - bv : bv - av) || a.name.localeCompare(b.name);
    });
  }, [displayed, search, cat, sort, asc]);
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
  const isCurrent = view === "current";
  const isSix = view === "six";
  const start = isCurrent ? period.currentStartTime : isSix ? period.windowStartTime : period.startTime;
  const end = isCurrent ? period.currentEndTime : isSix ? period.windowEndTime : period.endTime;
  const title = isCurrent ? `Current epoch · ${period.currentEpoch ?? "Unavailable"} · in progress`
    : isSix ? `Last 6 completed epochs · ${period.windowStartEpoch ?? "—"}–${period.windowEndEpoch ?? "—"}` : `Latest validated completed epoch · ${epochLabel}`;
  const comparison = isSix ? { current: `epochs ${period.windowStartEpoch ?? "—"}–${period.windowEndEpoch ?? "—"}`, previous: period.previousWindowStartEpoch !== null ? `epochs ${period.previousWindowStartEpoch}–${period.previousWindowEndEpoch}` : null }
    : { current: `epoch ${epochLabel}`, previous: period.previousEpoch !== null ? `epoch ${period.previousEpoch}` : null };
  const transactionsLabel = isCurrent ? "Observed transactions" : isSix ? "Total transactions" : "Transactions";
  const walletsLabel = isCurrent ? "Active wallets (pending)" : isSix ? "Avg wallets / epoch" : "Active wallets";
  const tvlLabel = isCurrent ? "Latest TVL snapshot" : "TVL · near period end";
  const transactionHelp = TRANSACTIONS + (isSix ? " This view sums six consecutive validated completed epochs." : isCurrent ? " This view is an incomplete count collected so far in the current epoch. Activity before collection began may be missing. Refresh for updated counts." : "");
  const walletHelp = isCurrent ? "Current-epoch wallet counts are pending completed-epoch validation. Pending does not mean zero." : WALLETS + (isSix ? " This view shows the arithmetic average across six epochs, not unique wallets over 30 days. The same wallet can appear in multiple epochs." : "");
  const tvlHelp = isCurrent ? "Latest available DefiLlama Cardano TVL snapshot, cached for up to five minutes and accepted only within the last 24 hours. It is a balance at the displayed source timestamp, not a sum or a live tick." : TVL;
  const reportingHelp = isCurrent ? `As of ${utcTime(period.asOf)}. The current epoch is incomplete. Transactions are observations so far; active wallets await validation. No growth against a full epoch is shown. ${period.liveAvailable ? "Refresh for updated observations." : "The live feed is delayed or does not match this epoch, so transaction counts are unavailable."}`
    : isSix ? "Transactions are summed over exactly six consecutive validated completed epochs. Wallets show the average per epoch, not unique 30-day wallets. Growth compares these six epochs only with the preceding six; at least twelve consecutive epochs are needed. TVL is a single snapshot near the period’s end, never summed."
    : start !== null && end !== null ? `Transactions and wallets cover epoch ${epochLabel}: ${utcTime(start)} to ${utcTime(end)}. The unfinished epoch is excluded. TVL uses a daily snapshot near this epoch’s end, with its exact time shown separately.` : "Validated completed-epoch history is unavailable. Partial live counts are not substituted.";
  const progress = start !== null && end !== null ? Math.max(0, Math.min(100, (period.asOf - start) / (end - start) * 100)) : null;
  const gainers = comparison.previous && !isCurrent ? filtered.filter(d => d.txGrowth !== null && d.txGrowth > 0).sort((a, b) => b.txGrowth! - a.txGrowth!) : [];
  const decliners = comparison.previous && !isCurrent ? filtered.filter(d => d.txGrowth !== null && d.txGrowth < 0).sort((a, b) => a.txGrowth! - b.txGrowth!) : [];
  return <section className="epoch-directory" aria-label="DApp activity by reporting period">
    <div className="epoch-view-picker" role="group" aria-label="Activity period">
      {([ ["completed", "Last completed epoch", "Default · validated totals"], ["six", "Last 6 completed epochs", "30 days · completed history"], ["current", "Current epoch", "In progress · incomplete"] ] as const).map(([key, label, detail]) => <button type="button" key={key} data-period={key} aria-pressed={view === key} onClick={() => { setView(key); setPage(1); setSort("epochTransactions"); setAsc(false); }}><strong>{label}</strong><span>{detail}</span></button>)}
    </div>
    <div className={swap ? "home-swap-stats" : "epoch-summary-row"}>
      {swap && <div className="home-swap-widget" style={{ width: 380, flexShrink: 0, minWidth: 0 }}>{swap}</div>}
      <div className="epoch-summary-stats">
        <CompactStat label="Listed DApp TVL ≈" value={listedTvlTotal(displayed.map(d => d.tvl))} isCurrency color="#8b5cf6" detail="Sum only when every listed DApp has a TVL snapshot at the same observation time. This is not total Cardano TVL. See each amount’s tooltip for its timestamp and source." />
        <CompactStat label="DApps with data" value={dapps.length} color="#f59e0b" />
        <CompactStat label={isSix ? "Epochs in period" : "Reporting epoch"} value={isSix ? (start === null ? null : 6) : isCurrent ? period.currentEpoch : period.completedEpoch} color="#06b6d4" detail={title} />
        <CompactStat label="Period length (days)" value={start !== null && end !== null ? (end - start) / 86400 : null} color="#10b981" />
      </div>
    </div>
    {notice}
    <div data-testid="epoch-directory-period" className="card epoch-period">
      <div><div className="epoch-period-heading"><h2>{title}</h2><MetricTooltip label="About the reporting period" text={reportingHelp} /></div>
        <p>{start !== null && end !== null ? `${epochDate(start)} – ${epochDate(end)} · UTC · ${isSix ? 30 : 5} days` : "Reporting period unavailable"}</p></div>
      <div data-testid="growth-period"><strong>{isCurrent ? "Growth not shown for an unfinished epoch" : comparison.previous ? `Changes: ${comparison.current} compared with ${comparison.previous}` : isSix ? "Previous 6-epoch period unavailable" : "Previous-epoch comparison unavailable"}</strong><p>{isCurrent ? `Observed as of ${utcTime(period.asOf)}` : isSix ? "6 completed epochs versus the preceding 6" : "Two completed 5-day epochs"}</p></div>
      {isCurrent && progress !== null && <div className="epoch-progress"><label htmlFor="current-epoch-progress">Epoch progress as of this page load: {progress.toFixed(1)}%</label><progress id="current-epoch-progress" value={progress} max={100} /><span>{period.liveAvailable ? "Partial observations · refresh to update" : "Live feed delayed · observations unavailable"}</span></div>}
    </div>
    {(gainers.length > 0 || decliners.length > 0) && <div className="epoch-movers" aria-label="Transaction changes among shown DApps">{gainers[0] && <span>Largest transaction rise: <strong>{gainers[0].name} {growthText(gainers[0].txGrowth)}</strong></span>}{decliners[0] && <span>Largest transaction decline: <strong>{decliners[0].name} {growthText(decliners[0].txGrowth)}</strong></span>}<span>Among shown DApps · same comparison as the table</span></div>}
    <div className="epoch-toolbar">
      <input aria-label="Search DApps" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search DApps..." />
      {!hideFilters && <div className="epoch-filters">{CATEGORIES.filter(c => c === "ALL" || dapps.some(d => d.hasRecordedData && d.category === c)).map(c => {
        const color = c === "ALL" ? "var(--accent)" : CATEGORY_COLORS[c] || "var(--text-secondary)";
        return <button type="button" key={c} aria-pressed={cat === c} onClick={() => { setCat(c); setPage(1); }} style={{ color, background: cat === c ? "var(--accent-dim)" : "transparent" }}>{c === "ALL" ? "All" : c === "COLLECTION" ? "NFT" : c.charAt(0) + c.slice(1).toLowerCase()}</button>;
      })}</div>}
      <span aria-live="polite">{filtered.length} DApps</span>
    </div>
    <div className="card epoch-table-wrap"><table data-testid="epoch-directory-table" className="epoch-table" aria-label={title}>
      <thead><tr>{sortHeader("DApp", "name")}{sortHeader(transactionsLabel, "epochTransactions", transactionHelp)}{sortHeader(walletsLabel, "epochWallets", walletHelp)}{sortHeader(tvlLabel, "tvl", tvlHelp)}<th scope="col">Links</th></tr></thead>
      <tbody>{rows.map((d, index) => <tr data-dapp={d.slug} key={d.slug}>
        <th scope="row" className="epoch-dapp-cell"><div className="epoch-dapp-name"><span className="epoch-rank">{(currentPage - 1) * pageSize + index + 1}</span>
          <Link href={`/dapp/${d.slug}`}><DappLogo slug={d.slug} name={d.name} src={d.logo} size={36} /><div><strong>{d.name}</strong><span className="epoch-category"><CategoryBadge category={d.category} /></span></div></Link>
          <MetricTooltip label={`Coverage for ${d.name}`} text={SCOPES[d.slug] ?? "Activity covers this DApp’s published tracked contracts only. See its profile for the contract list and methodology."} />
        </div></th>
        <td data-metric="transactions"><div className="epoch-mobile-label">{transactionsLabel} <MetricTooltip label={`About ${d.name} transactions`} text={transactionHelp} /></div><strong className="epoch-value">{number(d.epochTransactions)}</strong>
          {!isCurrent && <><Growth name={d.name} metric="transactions" current={d.epochTransactions} previous={d.previousTransactions} value={d.txGrowth} comparison={comparison} /><span className="epoch-previous">Previous: {number(d.previousTransactions)}</span></>}
          {isCurrent && <span className="epoch-previous">{d.liveSince !== null ? `Observed since ${utcTime(d.liveSince)} · partial` : "Collection start unavailable · partial"}</span>}</td>
        <td data-metric="wallets"><div className="epoch-mobile-label">{walletsLabel} <MetricTooltip label={`About ${d.name} active wallets`} text={walletHelp} /></div><strong className="epoch-value">{isCurrent ? "Pending" : number(d.epochWallets)}</strong>
          {!isCurrent && <><Growth name={d.name} metric={isSix ? "average wallets per epoch" : "active wallets"} current={d.epochWallets} previous={d.previousWallets} value={d.walletGrowth} comparison={comparison} extra={d.attributionPercent !== null ? ` Owners were identifiable in ${d.attributionPercent}% of tracked order/request outputs in the reporting period. This does not measure whole-protocol coverage.` : ""} /><span className="epoch-previous">Previous: {number(d.previousWallets)}</span></>}
          {isCurrent && <span className="epoch-previous">Awaiting completed-epoch validation</span>}</td>
        <td data-metric="tvl"><div className="epoch-mobile-label">{tvlLabel} <MetricTooltip label={`About ${d.name} TVL`} text={tvlHelp} /></div><TvlCell name={d.name} tvl={d.tvl} epoch={isCurrent ? period.currentEpoch : period.completedEpoch} current={isCurrent} /></td>
        <td className="epoch-links">{d.link && <a href={d.link} target="_blank" rel="noopener noreferrer" aria-label={`${d.name} website`}><Globe size={16} aria-hidden="true" /></a>}</td>
      </tr>)}{!rows.length && <tr><td colSpan={5} className="epoch-empty">No DApps with recorded data match these filters.</td></tr>}</tbody>
    </table></div>
    <p className="epoch-footnote">Transactions and wallets cover tracked contracts only. Wallets are identifiable order owners, not people. TVL is a separate DefiLlama estimate with its own protocol coverage. — means unavailable.</p>
    {totalPages > 1 && <nav className="epoch-pagination" aria-label="DApp pages"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>← Previous</button><span>Page {currentPage} of {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Next →</button></nav>}
  </section>;
}

function Growth({ name, metric, current, previous, value, comparison, extra = "" }: { name: string; metric: string; current: number | null; previous: number | null; value: number | null; comparison: { current: string; previous: string | null }; extra?: string }) {
  const change = current !== null && previous !== null ? current - previous : null;
  const explanation = `${name} ${metric}: ${number(current)} in ${comparison.current} versus ${number(previous)} in ${comparison.previous ?? "an unavailable previous period"}. ${change !== null ? `${number(Math.abs(change))} ${change < 0 ? "fewer" : "more"}. ` : ""}${value === null ? "A percentage is unavailable when comparable data is missing or the previous count is zero." : "The percentage compares these matching completed periods using unrounded totals."}${extra}`;
  return <div className="epoch-growth" data-metric={metric === "transactions" ? "tx-growth" : "wallet-growth"} style={{ color: value === null || value === 0 ? "var(--text-secondary)" : value > 0 ? "var(--green)" : "var(--red)" }}><MetricTooltip text={explanation} label={`${name} ${metric} change`}>
    {growthText(value)}{comparison.previous ? ` vs ${comparison.previous}` : " · unavailable"}<Info size={13} aria-hidden="true" />
  </MetricTooltip></div>;
}

function TvlCell({ name, tvl, epoch, current = false }: { name: string; tvl: EpochTvl | null; epoch: number | null; current?: boolean }) {
  const snapshot = tvl?.current;
  if (!snapshot) return <div><MetricTooltip label={`${name} TVL unavailable`} text={current ? "A fresh DefiLlama Cardano TVL snapshot is unavailable. A dash means unknown, not zero." : "A verified DefiLlama Cardano TVL snapshot within 24 hours before this period’s end is unavailable. A dash means unknown, not zero."}><strong className="epoch-value">—</strong><Info size={14} aria-hidden="true" /></MetricTooltip><span className="epoch-previous">Unavailable</span></div>;
  const age = snapshot.epochEnd - snapshot.observedAt;
  const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(snapshot.usd);
  const detail = `${name} TVL for epoch ${epoch}: ${snapshot.usd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })}. Source: DefiLlama, ${tvl.scope}. Observed ${utcTime(snapshot.observedAt)}. ${current ? "Latest available snapshot, cached for up to five minutes. This is not a live tick or an end-of-epoch value." : `${Math.floor(age / 3600)}h ${Math.floor(age % 3600 / 60)}m before the reporting period ended. This daily snapshot approximates the period-end balance; it is not an exact epoch-boundary measurement.`} TVL is a balance, never a sum across epochs. USD changes also reflect token prices. Provider coverage differs from our transaction and wallet scripts; separate staking, borrowed and pool2 series are excluded.`;
  return <div><MetricTooltip label={`${name} TVL snapshot details`} text={detail}><strong className="epoch-value">{age ? "≈ " : ""}{usd}</strong><Info size={14} aria-hidden="true" /></MetricTooltip>
    <span className="epoch-previous">{current ? `Observed ${utcTime(snapshot.observedAt)}` : age ? `~${Math.round(age / 3600)}h before period end` : "At period end"}</span></div>;
}
function growthText(value: number | null) { return value === null ? "—" : value === 0 ? "0.0%" : `${value > 0 ? "+" : "−"}${Math.abs(value) < 0.05 ? "<0.1" : Math.abs(value).toFixed(1)}%`; }
function number(value: number | null) { return value === null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 1 }); }
function epochDate(value: number) { return new Date(value * 1000).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }); }
function utcTime(value: number) { return new Date(value * 1000).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "medium" }) + " UTC"; }
