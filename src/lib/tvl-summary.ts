// Only reviewed provider mappings can supply directory TVL. Cardano core TVL
// excludes the provider's separately reported staking/borrowed/pool2 series.
export const TVL_PROTOCOLS: Record<string, { slug: string; id: string; scope: string }> = {
  minswap: { slug: "minswap-dex", id: "1494", scope: "Minswap DEX on Cardano" },
  sundaeswap: { slug: "sundaeswap", id: "parent#sundaeswap", scope: "SundaeSwap combined versions on Cardano" },
  wingriders: { slug: "wingriders", id: "1601", scope: "WingRiders on Cardano" },
};

export interface TvlSnapshot { usd: number; observedAt: number; epochEnd: number }
export interface EpochTvl {
  current: TvlSnapshot | null;
  previous: TvlSnapshot | null;
  sourceUrl: string;
  scope: string;
}
export interface CompactTvlHistory { id: string; points: { date: number; totalLiquidityUSD: number }[] }

export function listedTvlTotal(rows: (EpochTvl | null)[]): number | null {
  const first = rows[0]?.current;
  if (!first || rows.some(row => !row?.current || row.current.observedAt !== first.observedAt || row.current.epochEnd !== first.epochEnd)) return null;
  const total = rows.reduce((sum, row) => sum + row!.current!.usd, 0);
  return Number.isFinite(total) ? total : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function compactProtocolTvl(slug: string, payload: unknown): CompactTvlHistory | null {
  const protocol = Object.hasOwn(TVL_PROTOCOLS, slug) ? TVL_PROTOCOLS[slug] : null;
  const data = record(payload);
  if (!protocol || data?.id !== protocol.id) return null;
  const chain = record(record(data.chainTvls)?.Cardano);
  if (!Array.isArray(chain?.tvl)) return null;
  const points = new Map<number, number>();
  for (const value of chain.tvl) {
    const point = record(value);
    if (!point || typeof point.date !== "number" || !Number.isInteger(point.date) || point.date <= 0
      || typeof point.totalLiquidityUSD !== "number" || !Number.isFinite(point.totalLiquidityUSD) || point.totalLiquidityUSD < 0) continue;
    // Conflicting snapshots must not depend on the order of the response.
    if (points.has(point.date) && points.get(point.date) !== point.totalLiquidityUSD) return null;
    points.set(point.date, point.totalLiquidityUSD);
  }
  return { id: protocol.id, points: [...points].sort((a, b) => a[0] - b[0]).map(([date, totalLiquidityUSD]) => ({ date, totalLiquidityUSD })) };
}

export function selectCompactTvl(slug: string, history: CompactTvlHistory | null, endTime: number, previousEndTime: number | null, now = Date.now() / 1000): EpochTvl | null {
  const protocol = Object.hasOwn(TVL_PROTOCOLS, slug) ? TVL_PROTOCOLS[slug] : null;
  if (!protocol || history?.id !== protocol.id || !Number.isFinite(endTime) || endTime > now) return null;
  const snapshot = (end: number | null): TvlSnapshot | null => {
    if (end === null || !Number.isFinite(end) || end > now) return null;
    for (let i = history.points.length - 1; i >= 0; i--) {
      const point = history.points[i];
      if (point.date <= end && end - point.date <= 86400) return { usd: point.totalLiquidityUSD, observedAt: point.date, epochEnd: end };
    }
    return null;
  };
  return {
    current: snapshot(endTime), previous: previousEndTime !== null && previousEndTime < endTime ? snapshot(previousEndTime) : null,
    sourceUrl: `https://defillama.com/protocol/${protocol.slug}`, scope: protocol.scope,
  };
}

export function selectEpochTvl(slug: string, payload: unknown, endTime: number, previousEndTime: number | null, now = Date.now() / 1000): EpochTvl | null {
  return selectCompactTvl(slug, compactProtocolTvl(slug, payload), endTime, previousEndTime, now);
}
