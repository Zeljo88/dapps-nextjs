import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { compactProtocolTvl, selectCompactTvl, TVL_PROTOCOLS, type EpochTvl } from "./tvl-summary";

// One hourly refresh per protocol serves both TVL views. Cache only the compact,
// reviewed Cardano series; discard the multi-megabyte token histories after parsing.
const readProtocol = cache(unstable_cache(async (slug: string) => {
  const protocol = Object.hasOwn(TVL_PROTOCOLS, slug) ? TVL_PROTOCOLS[slug] : null;
  if (!protocol) throw new Error("Unreviewed TVL protocol");
  const response = await fetch(`https://api.llama.fi/protocol/${protocol.slug}`, {
    cache: "no-store", signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`TVL provider unavailable (${response.status})`);
  const history = compactProtocolTvl(slug, await response.json());
  if (!history) throw new Error("Invalid TVL identity or Cardano series");
  return history;
}, ["compact-cardano-tvl-v2"], { revalidate: 3600 }));

export async function fetchEpochTvl(slugs: string[], end: number | null, previousEnd: number | null): Promise<Record<string, EpochTvl | null>> {
  if (end === null || end > Date.now() / 1000) return {};
  return Object.fromEntries(await Promise.all(slugs.map(async slug => {
    try { return [slug, selectCompactTvl(slug, await readProtocol(slug), end, previousEnd)] as const; }
    catch { return [slug, null] as const; }
  })));
}

export async function fetchCurrentTvl(slugs: string[], now = Date.now() / 1000): Promise<Record<string, EpochTvl | null>> {
  return Object.fromEntries(await Promise.all(slugs.map(async slug => {
    try {
      return [slug, selectCompactTvl(slug, await readProtocol(slug), now, null)] as const;
    } catch { return [slug, null] as const; }
  })));
}
