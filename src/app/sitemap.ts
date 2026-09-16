import type { MetadataRoute } from "next";

import { fetchDapps } from "@/lib/backend";
import { categorySlugMap, isIndexableDapp, toSlug } from "@/lib/api";
import type { DappSeoRecord } from "@/lib/api";

const BASE = "https://dappsoncardano.com";
const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "hourly", priority: 1.0 },
    { url: `${BASE}/ecosystem`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/yields`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE}/swap`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/portfolio`, changeFrequency: "daily", priority: 0.6 },
  ];

  const categoryPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/category`, changeFrequency: "weekly", priority: 0.8 },
    ...Object.keys(categorySlugMap).map(slug => ({
      url: `${BASE}/category/${slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];

  const dapps = await fetchDapps();
  if (!Array.isArray(dapps)) {
    throw new Error("Backend returned an invalid DApp list for the sitemap");
  }

  const uniqueDapps = new Map<string, DappSeoRecord>();
  for (const dapp of dapps) {
    const slug = typeof dapp?.slug === "string" && dapp.slug
      ? dapp.slug
      : toSlug(dapp?.name || "");
    if (VALID_SLUG.test(slug) && isIndexableDapp(dapp)) {
      uniqueDapps.set(slug, dapp);
    }
  }

  const dappPages: MetadataRoute.Sitemap = Array.from(uniqueDapps, ([slug, dapp]) => {
    const tvl = dapp.tvl || 0;
    return {
      url: `${BASE}/dapp/${slug}`,
      changeFrequency: "daily",
      priority: tvl > 1_000_000 ? 0.9 : tvl > 0 ? 0.7 : 0.5,
    };
  });

  return [...staticPages, ...categoryPages, ...dappPages];
}
