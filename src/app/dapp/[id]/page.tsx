import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { count, dateTime, fetchAnalytics, fetchEvents } from "@/lib/analytics";
import { CoverageNotice, FeedUnavailable, Metric } from "@/components/ContractAnalytics";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchAnalytics().catch(() => null);
  const dapp = data?.dapps.find(item => item.slug === id);
  if (data && !dapp) notFound();
  return { title: dapp ? `${dapp.name} — Observed Cardano Contract Activity` : "DApp contract activity", description: dapp?.description, alternates: { canonical: `https://dappsoncardano.com/dapp/${id}` } };
}
export default async function DappPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchAnalytics().catch(() => null);
  if (!data) return <FeedUnavailable />;
  const dapp = data.dapps.find(item => item.slug === id);
  if (!dapp) notFound();
  const evidence = await fetchEvents(dapp.slug).catch(() => null);
  return <main className="analytics-page">
    <Link href="/">← All tracked DApps</Link><h1 style={{ marginTop: 24 }}>{dapp.name}</h1><p className="analytics-intro">{dapp.description}</p>
    <p className="analytics-links"><a href={dapp.website} target="_blank" rel="noopener noreferrer">Official website ↗</a><a href={dapp.sourceDocumentation || dapp.source} target="_blank" rel="noopener noreferrer">Contract mapping source ↗</a><span>Mapping reviewed {dapp.mappingReviewedOn ?? "—"}</span></p>
    <CoverageNotice status={data.status} />
    <div className="analytics-metrics"><Metric label="Observed tx since start" value={count(dapp.observedTransactions)} /><Metric label="Observed tx in last 24h*" value={count(dapp.observedTx24h)} detail={`Collection began ${dateTime(dapp.recordedSince)}`} /><Metric label="Payment scripts monitored" value={count(dapp.scripts.length)} /><Metric label="TVL / Volume / Token price" value="Unavailable" /></div>
    <h2>Tracked payment scripts</h2><div className="card analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Contract role</th><th>Payment script hash</th></tr></thead><tbody>{dapp.scripts.map(script => <tr key={script.hash}><td>{script.role}</td><td><a href={`https://cardanoscan.io/script/${script.hash}`} target="_blank" rel="noopener noreferrer"><code>{script.hash}</code> ↗</a></td></tr>)}</tbody></table></div>
    <h2>Recent transaction evidence</h2><p className="analytics-intro">Output-level events may share a transaction. The counts above deduplicate those events. Recent evidence includes provisional blocks.</p>
    {evidence ? <div className="card analytics-table-wrap"><table className="analytics-table"><thead><tr><th>Transaction</th><th>Event</th><th>Block</th><th>Time</th></tr></thead><tbody>{evidence.events.map(event => <tr key={`${event.tx}-${event.kind}-${event.ref}`}><td><a href={`https://cardanoscan.io/transaction/${event.tx}`} target="_blank" rel="noopener noreferrer"><code>{event.tx.slice(0, 16)}…{event.tx.slice(-8)}</code> ↗</a></td><td>{event.kind === "output_created" ? "Tracked output created" : "Tracked output spent"}</td><td>{count(event.height)}</td><td>{dateTime(event.time)}</td></tr>)}{!evidence.events.length && <tr><td colSpan={4}>No matching transactions observed yet.</td></tr>}</tbody></table></div> : <p>Transaction evidence is temporarily unavailable.</p>}
  </main>;
}
