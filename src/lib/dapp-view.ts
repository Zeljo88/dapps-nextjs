import type { TrackedDapp } from "./analytics";
import { epochMetrics, sixEpochComparison, type EpochPeriod } from "./epoch-summary";
import type { EpochTvl } from "./tvl-summary";

export function hasRecordedActivity(dapp: Pick<TrackedDapp, "observedTransactions">): boolean {
  return dapp.observedTransactions !== null && dapp.observedTransactions > 0;
}

export function dappLogo(slug: string): string {
  return `https://icons.llama.fi/${slug}.jpg`;
}

export function tableDapp(dapp: TrackedDapp, period: EpochPeriod | null, tvl: EpochTvl | null = null, currentTvl: EpochTvl | null = null) {
  return {
    id: dapp.slug, slug: dapp.slug, name: dapp.name, category: dapp.category,
    subCategory: dapp.subCategory, logo: dappLogo(dapp.slug), link: dapp.website,
    hasRecordedData: hasRecordedActivity(dapp),
    ...epochMetrics(dapp.slug, period),
    ...sixEpochComparison(dapp.slug, period),
    observedEpoch: dapp.observedEpoch ?? null,
    liveTransactions: typeof dapp.observedTxEpoch === "number" && Number.isFinite(dapp.observedTxEpoch) && dapp.observedTxEpoch >= 0 ? dapp.observedTxEpoch : null,
    liveSince: dapp.epochRecordedSince ?? null,
    tvl, currentTvl,
  };
}
