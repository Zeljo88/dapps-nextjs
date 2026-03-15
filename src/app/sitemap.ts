import { MetadataRoute } from "next";

const BASE = "https://dappsoncardano.com";
const API  = "http://20.79.10.28";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const static_pages: MetadataRoute.Sitemap = [
    { url: BASE,                  lastModified: new Date(), changeFrequency: "hourly",  priority: 1.0 },
    { url: `${BASE}/ecosystem`,   lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${BASE}/yields`,      lastModified: new Date(), changeFrequency: "hourly",  priority: 0.8 },
    { url: `${BASE}/swap`,        lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];

  // Dynamic DApp pages
  let dapp_pages: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API}/dapps/list-dapps`, { next: { revalidate: 86400 } });
    const dapps = await res.json();
    dapp_pages = dapps.map((d: any) => ({
      url: `${BASE}/dapp/${encodeURIComponent(d.name)}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: d.tvl > 1_000_000 ? 0.9 : d.tvl > 0 ? 0.7 : 0.5,
    }));
  } catch {}

  return [...static_pages, ...dapp_pages];
}
