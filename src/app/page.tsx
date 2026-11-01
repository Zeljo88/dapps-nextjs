import type { Metadata } from "next";
import { fetchAnalytics } from "@/lib/analytics";
import { AnalyticsMetrics, ContractTable, CoverageNotice, FeedUnavailable } from "@/components/ContractAnalytics";
import CustomSwap from "@/components/CustomSwap";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cardano DApp Activity — On-chain Contract Observations", description: "Explore observed Cardano DApp contract activity from our own mainnet node, with published script mappings, collection dates and transaction evidence.", alternates: { canonical: "https://dappsoncardano.com" } };
export default async function HomePage() {
  const data = await fetchAnalytics().catch(() => null);
  if (!data) return <FeedUnavailable />;
  return <main className="analytics-page">
    <div className="hero-banner"><span className="analytics-eyebrow">CARDANO MAINNET · OPEN METHODOLOGY</span><h1>Cardano DApp activity, with evidence.</h1><p>Explore transactions observed by our own node. See exactly which contracts we track and where each number comes from.</p></div>
    <CoverageNotice status={data.status} /><AnalyticsMetrics {...data} />
    <h2>Tracked DApps</h2><p className="analytics-intro">A growing registry of officially sourced payment scripts. Select a DApp to inspect its coverage and recent transactions.</p><ContractTable dapps={data.dapps} />
    <section className="analytics-swap"><div><h2>Swap Cardano tokens</h2><p className="analytics-intro">Quotes are supplied by DexHunter, independently of our contract activity feed.</p></div><div style={{ maxWidth: 420 }}><CustomSwap /></div></section>
  </main>;
}
