import Link from "next/link";
import { count, dateTime, type IndexerStatus, type TrackedDapp } from "@/lib/analytics";

export function CoverageNotice({ status }: { status: IndexerStatus }) {
  return <aside className="coverage-notice" aria-label="Data coverage">
    <div className="coverage-line"><strong className={status.fresh ? "feed-live" : "feed-stale"}>{status.fresh ? "● Feed current" : "● Feed delayed"}</strong><span>Mainnet · Epoch {status.checkpoint?.epoch ?? "—"} · Block {count(status.checkpoint?.height ?? null)}</span></div>
    <p><strong>Partial contract coverage.</strong> Recording since {dateTime(status.startedAt)}. Counts include transactions creating tracked outputs or spending outputs observed after that checkpoint. A transaction counts once per DApp. Counts wait for 3 subsequent blocks and remain subject to chain rollbacks.</p>
    <p>These observations are lower bounds, not complete protocol totals or trade counts. TVL, volume, token prices and active users are unavailable in this feed. <Link href="/methodology">How we measure →</Link></p>
    <small>Last block received: {dateTime(status.lastReceivedAt)} · {status.lagBlocks ?? "—"} blocks behind reported tip · Refresh the page for the latest observations.</small>
  </aside>;
}
export function AnalyticsMetrics({ status, dapps }: { status: IndexerStatus; dapps: TrackedDapp[] }) {
  return <div className="analytics-metrics"><Metric label="DApps with tracked contracts" value={count(dapps.length)} /><Metric label="Payment scripts monitored" value={count(status.watchedScripts)} /><Metric label="Distinct observed transactions" value={status.startedAt === null ? "—" : count(status.counts.transactions)} detail="Since collection began · includes recent provisional blocks" /><Metric label="Financial metrics" value="Unavailable" detail="TVL, volume and prices need separate validation" /></div>;
}
export function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="card analytics-metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}
export function ContractTable({ dapps }: { dapps: TrackedDapp[] }) {
  return <div className="card analytics-table-wrap"><table className="analytics-table"><thead><tr><th>DApp / coverage</th><th>Observed tx since start</th><th>Observed tx in last 24h*</th><th>Scripts</th><th>Last observed activity</th></tr></thead><tbody>
    {dapps.map(dapp => <tr key={dapp.slug}><td><Link href={`/dapp/${dapp.slug}`}><strong>{dapp.name}</strong></Link><small>DeFi · Partial coverage · {dapp.fresh ? "Feed current" : "Feed delayed"}</small></td><td>{count(dapp.observedTransactions)}</td><td>{count(dapp.observedTx24h)}</td><td>{dapp.scripts.length}</td><td>{dateTime(dapp.lastObservedActivity)}</td></tr>)}
    {!dapps.length && <tr><td colSpan={5}>No contracts in this category are tracked yet.</td></tr>}
  </tbody></table><p className="analytics-footnote">*The 24h window starts at collection time when less than 24 hours of data is available. Zero means no matching activity observed; coverage remains partial.</p></div>;
}
export function FeedUnavailable() {
  return <main className="analytics-page"><h1>Analytics feed temporarily unavailable</h1><p className="analytics-intro">We could not reach the data service. Refresh to try again. Previous figures are not presented as current data.</p><Link href="/methodology">Read our data methodology →</Link></main>;
}
