import "server-only";
import { unstable_cache } from "next/cache";
import { selectEpochTvl, TVL_PROTOCOLS, type EpochTvl } from "./tvl-summary";

// Cache only the final selected balances and provenance, never the full daily
// provider history or transaction records. Failures do not cache as zero TVL.
const readEpochTvl = unstable_cache(async (slug: string, end: number, previousEnd: number | null): Promise<EpochTvl | null> => {
  const protocol = Object.hasOwn(TVL_PROTOCOLS, slug) ? TVL_PROTOCOLS[slug] : null;
  if (!protocol) return null;
  const response = await fetch(`https://api.llama.fi/protocol/${protocol.slug}`, {
    cache: "no-store", signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`TVL provider unavailable (${response.status})`);
  return selectEpochTvl(slug, await response.json(), end, previousEnd);
}, ["epoch-tvl-cardano-core-v1"], { revalidate: 3600 });

export async function fetchEpochTvl(slugs: string[], end: number | null, previousEnd: number | null): Promise<Record<string, EpochTvl | null>> {
  if (end === null || end > Date.now() / 1000) return {};
  return Object.fromEntries(await Promise.all(slugs.map(async slug => {
    try { return [slug, await readEpochTvl(slug, end, previousEnd)] as const; }
    catch { return [slug, null] as const; }
  })));
}
