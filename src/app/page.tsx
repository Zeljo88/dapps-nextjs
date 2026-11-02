import type { Metadata } from "next";
import { fetchAnalytics } from "@/lib/analytics";
import { hasRecordedActivity, tableDapp } from "@/lib/dapp-view";
import { CoverageNotice, FeedUnavailable } from "@/components/ContractAnalytics";
import DAppTable from "@/components/DAppTable";
import CompactStat from "@/components/CompactStat";
import CustomSwap from "@/components/CustomSwap";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Cardano DApps Analytics",
  description: "Explore observed Cardano DApp contract activity from our own mainnet node, with published coverage and transaction evidence.",
  alternates: { canonical: "https://dappsoncardano.com" },
};

export default async function HomePage() {
  const data = await fetchAnalytics().catch(() => null);
  if (!data) return <FeedUnavailable />;
  const dapps = data.dapps.filter(hasRecordedActivity);
  return <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>
    <div className="hero-banner" style={{ padding: "18px 28px" }}>
      <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, lineHeight: 1.2 }}>Cardano DApps Analytics</h1>
          <p style={{ fontSize: 14, opacity: 0.85, maxWidth: 500 }}>On-chain activity from our Cardano node. Only DApps with recorded data are shown.</p></div>
      </div>
    </div>
    <div className="home-swap-stats" style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "stretch" }}>
      <div className="home-swap-widget" style={{ width: 380, flexShrink: 0, minWidth: 0 }}><CustomSwap /></div>
      <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8, alignContent: "stretch" }}>
        <CompactStat label="Total TVL" value={null} isCurrency color="#8b5cf6" />
        <CompactStat label="30D Volume" value={null} isCurrency color="#10b981" />
        <CompactStat label="24H Volume" value={null} isCurrency color="#06b6d4" />
        <CompactStat label="Active Users" value={null} color="#ec4899" />
        <CompactStat label="Observed Txs" value={data.status.startedAt === null ? null : data.status.counts.transactions} color="#3b82f6" detail="Distinct recorded transactions since collection began, including recent provisional blocks." />
        <CompactStat label="DApps with data" value={dapps.length} color="#f59e0b" />
        <CompactStat label="Epoch" value={data.status.checkpoint?.epoch ?? null} color="#06b6d4" />
        <CompactStat label="ADA Price" value={null} isPrice color="#8b5cf6" />
      </div>
    </div>
    <CoverageNotice status={data.status} compact />
    <DAppTable dapps={dapps.map(tableDapp)} adaPrice={0} />
  </main>;
}
