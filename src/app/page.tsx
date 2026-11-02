import type { Metadata } from "next";
import { fetchAnalytics, fetchHistory } from "@/lib/analytics";
import { selectEpochPeriod, directoryPeriod } from "@/lib/epoch-summary";
import { hasRecordedActivity, tableDapp } from "@/lib/dapp-view";
import { fetchEpochTvl } from "@/lib/tvl";
import { listedTvlTotal } from "@/lib/tvl-summary";
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
  const [data, history] = await Promise.all([fetchAnalytics().catch(() => null), fetchHistory().catch(() => null)]);
  if (!data) return <FeedUnavailable />;
  const dapps = data.dapps.filter(hasRecordedActivity);
  const period = selectEpochPeriod(history, data.status.registryDigest);
  const tvl = await fetchEpochTvl(dapps.map(dapp => dapp.slug), period?.current.endTime ?? null, period?.previous?.endTime ?? null);
  const listedTvl = listedTvlTotal(dapps.map(dapp => tvl[dapp.slug] ?? null));
  return <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>
    <div className="hero-banner" style={{ padding: "18px 28px" }}>
      <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, lineHeight: 1.2 }}>Cardano DApps Analytics</h1>
          <p style={{ fontSize: 14, opacity: 0.85, maxWidth: 600 }}>Transactions and wallets for the latest validated completed epoch. TVL uses a snapshot near its end.</p></div>
      </div>
    </div>
    <div className="home-swap-stats" style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "stretch" }}>
      <div className="home-swap-widget" style={{ width: 380, flexShrink: 0, minWidth: 0 }}><CustomSwap /></div>
      <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8, alignContent: "stretch" }}>
        <CompactStat label="Listed DApp TVL ≈" value={listedTvl} isCurrency color="#8b5cf6" detail="Sum of the listed DApps’ DefiLlama Cardano TVL at a shared snapshot near the reporting epoch’s end. Not total Cardano TVL. The table shows each source and timestamp." />
        <CompactStat label="DApps with data" value={dapps.length} color="#f59e0b" />
        <CompactStat label="Reporting epoch" value={period?.current.epoch ?? null} color="#06b6d4" detail="Latest completed epoch that passed validation. The unfinished network epoch is excluded." />
        <CompactStat label="Epoch length (days)" value={period ? (period.current.endTime - period.current.startTime) / 86400 : null} color="#10b981" />
      </div>
    </div>
    <CoverageNotice status={data.status} compact />
    <DAppTable dapps={dapps.map(dapp => tableDapp(dapp, period, tvl[dapp.slug] ?? null))} period={directoryPeriod(period)} />
  </main>;
}
