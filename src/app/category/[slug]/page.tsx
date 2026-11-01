import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAnalytics } from "@/lib/analytics";
import { ContractTable, CoverageNotice, FeedUnavailable } from "@/components/ContractAnalytics";
import { categoryDisplayName, categorySlugMap } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const {slug} = await params; if (!categorySlugMap[slug]) notFound(); return { title: `Cardano ${categoryDisplayName[slug]} DApps`, description: `Observed contract activity and coverage for Cardano ${categoryDisplayName[slug]} DApps.`, alternates: { canonical: `https://dappsoncardano.com/category/${slug}` } }; }
export default async function Category({params}: {params: Promise<{slug:string}>}) {
  const {slug} = await params;
  const categories = categorySlugMap[slug];
  if (!categories) notFound();
  const data = await fetchAnalytics().catch(() => null);
  if (!data) return <FeedUnavailable />;
  return <main className="analytics-page"><Link href="/category">← Categories</Link><h1 style={{marginTop:24}}>{categoryDisplayName[slug]} DApps</h1><p className="analytics-intro">Only DApps with reviewed contract mappings appear here. This is not a complete list of Cardano projects.</p><CoverageNotice status={data.status} /><ContractTable dapps={data.dapps.filter(d => categories.includes(d.category))} /></main>;
}
