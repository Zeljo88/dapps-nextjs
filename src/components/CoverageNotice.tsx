"use client";
import Link from "next/link";
import type { IndexerStatus } from "@/lib/analytics";
import { feedIsFresh } from "@/lib/feed-freshness";
import { useClock } from "@/lib/use-clock";
function dateTime(value: number | null) { return value === null ? "Not available" : new Date(value * 1000).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC"; }
function count(value: number | null) { return value === null ? "Unavailable" : value.toLocaleString("en-US"); }

export function CoverageNotice({ status, compact = false }: { status: IndexerStatus; compact?: boolean }) {
  const now = useClock(status.snapshotAt ?? 0);
  const fresh = feedIsFresh(status, now);
  if (compact) return <aside className="card" aria-label="Data coverage" style={{ padding: "12px 16px", margin: "0 0 20px", fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)" }}>
    <div style={{ display: "flex", gap: "6px 16px", alignItems: "center", flexWrap: "wrap" }}>
      <strong className={fresh ? "feed-live" : "feed-stale"}>{fresh ? "● Feed current" : "● Feed delayed"}</strong>
      <span><strong>Partial contract coverage.</strong> Since {dateTime(status.startedAt)}</span>
      <Link href="/methodology" style={{ color: "var(--accent)" }}>Methodology & coverage ↗</Link>
    </div>
    <details style={{ marginTop: 4 }}><summary style={{ cursor: "pointer", color: "var(--text-muted)" }}>Data availability and collection details</summary>
      <p style={{ marginTop: 8 }}>This status describes the live collector. Completed-epoch activity uses independently validated totals from our own node; those periods can precede the live collector. Live counters wait for three subsequent blocks and can change after rollbacks. Recorded-period fees and observed balances on detail pages have their own dates and partial coverage. Directory TVL is a separate DefiLlama estimate with its own timestamp and coverage; it is not calculated from our observed balances. Trading volume and counts of individual people are unavailable.</p>
      <p>Last block: {dateTime(status.lastReceivedAt)} · Block {count(status.checkpoint?.height ?? null)} · {status.lagBlocks ?? "—"} blocks behind the reported tip. Current epoch observations refresh every 30 seconds while that view is open. Cached pages never supply current-epoch counts.</p>
    </details>
  </aside>;
  return <aside className="coverage-notice" aria-label="Data coverage">
    <div className="coverage-line"><strong className={fresh ? "feed-live" : "feed-stale"}>{fresh ? "● Feed current" : "● Feed delayed"}</strong><span>Mainnet · Epoch {status.checkpoint?.epoch ?? "—"} · Block {count(status.checkpoint?.height ?? null)}</span></div>
    <p><strong>Partial contract coverage.</strong> Recording since {dateTime(status.startedAt)}. Counts include transactions creating tracked outputs or spending outputs observed after that checkpoint. A transaction counts once per DApp. Counts wait for 3 subsequent blocks and remain subject to chain rollbacks.</p>
    <p>These observations are lower bounds, not complete protocol totals or trade counts. TVL, volume, token prices and active users are unavailable in this feed. <Link href="/methodology">How we measure →</Link></p>
    <small>Last block received: {dateTime(status.lastReceivedAt)} · {status.lagBlocks ?? "—"} blocks behind reported tip · Refresh the page for the latest observations.</small>
  </aside>;
}
