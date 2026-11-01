import Link from "next/link";
import { fetchAnalytics } from "@/lib/analytics";
import { FeedUnavailable } from "@/components/ContractAnalytics";
import { categorySlugMap, categoryDisplayName } from "@/lib/api";
export const dynamic = "force-dynamic";
export const metadata = { title: "Cardano DApp Categories", description: "Browse the categories covered by our growing contract activity registry.", alternates: { canonical: "https://dappsoncardano.com/category" } };
export default async function Categories() {
  const data = await fetchAnalytics().catch(() => null);
  if (!data) return <FeedUnavailable />;
  return <main className="analytics-page"><h1>Explore Cardano DApp categories</h1><p className="analytics-intro">Our registry currently focuses on selected DeFi contracts. Other categories will be added as their contract mappings are verified.</p><div className="analytics-metrics">{Object.entries(categorySlugMap).map(([slug, categories]) => { const count = data.dapps.filter(d => categories.includes(d.category)).length; return <Link href={`/category/${slug}`} key={slug} className="card analytics-metric"><strong>{categoryDisplayName[slug]}</strong><span>{count ? `${count} DApps with tracked contracts` : "Contract coverage not added yet"}</span></Link>; })}</div></main>;
}
