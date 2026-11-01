import type { MetadataRoute } from "next";
import { fetchAnalytics } from "@/lib/analytics";
import { categorySlugMap } from "@/lib/api";
export const dynamic = "force-dynamic";
const BASE = "https://dappsoncardano.com";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { dapps } = await fetchAnalytics();
  return [{url:BASE,changeFrequency:"hourly",priority:1}, ...["/ecosystem","/methodology","/category","/yields","/swap","/portfolio",...Object.keys(categorySlugMap).map(s=>`/category/${s}`),...dapps.map(d=>`/dapp/${d.slug}`)].map(path=>({url:BASE+path,changeFrequency:"daily" as const,priority:0.7}))];
}
