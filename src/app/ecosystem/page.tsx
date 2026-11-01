import { fetchAnalytics } from "@/lib/analytics";
import { AnalyticsMetrics, ContractTable, CoverageNotice, FeedUnavailable } from "@/components/ContractAnalytics";
export const dynamic = "force-dynamic";
export const metadata = { title: "Cardano Ecosystem — Tracked Contract Coverage", description: "View the coverage of our selective Cardano mainnet contract activity indexer.", alternates: {canonical:"https://dappsoncardano.com/ecosystem"} };
export default async function Ecosystem() { const data = await fetchAnalytics().catch(() => null); if (!data) return <FeedUnavailable />; return <main className="analytics-page"><h1>Our view of the Cardano ecosystem</h1><p className="analytics-intro">The figures below describe our tracked registry. They are not totals for the entire Cardano ecosystem.</p><CoverageNotice status={data.status} /><AnalyticsMetrics {...data} /><ContractTable dapps={data.dapps} /></main>; }
