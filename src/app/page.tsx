import type { Metadata } from "next";
import { fetchAnalytics, fetchHistory } from "@/lib/analytics";
import { selectEpochPeriod, directoryPeriod } from "@/lib/epoch-summary";
import { hasRecordedActivity, tableDapp } from "@/lib/dapp-view";
import { fetchEpochTvl, fetchCurrentTvl } from "@/lib/tvl";
import { CoverageNotice, FeedUnavailable } from "@/components/ContractAnalytics";
import DAppTable from "@/components/DAppTable";
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
  const reporting = directoryPeriod(period, data.status);
  const slugs = dapps.map(dapp => dapp.slug);
  const [tvl, currentTvl] = await Promise.all([
    fetchEpochTvl(slugs, period?.current.endTime ?? null, period?.previous?.endTime ?? null),
    fetchCurrentTvl(slugs, reporting.asOf),
  ]);
  return <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }}>
    <div className="hero-banner" style={{ padding: "18px 28px" }}>
      <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, lineHeight: 1.2 }}>Cardano DApps Analytics</h1>
          <p style={{ fontSize: 14, opacity: 0.85, maxWidth: 600 }}>Compare a completed epoch, six completed epochs, or current partial observations. The last completed epoch is selected by default.</p></div>
      </div>
    </div>
    <DAppTable dapps={dapps.map(dapp => tableDapp(dapp, period, tvl[dapp.slug] ?? null, currentTvl[dapp.slug] ?? null))} period={reporting}
      swap={<CustomSwap />} notice={<CoverageNotice status={data.status} compact />} />
  </main>;
}
