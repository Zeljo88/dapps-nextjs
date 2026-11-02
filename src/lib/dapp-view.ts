import type { TrackedDapp } from "./analytics";
import { epochMetrics, sixEpochMetrics, type EpochPeriod } from "./epoch-summary";

export function hasRecordedActivity(dapp: Pick<TrackedDapp, "observedTransactions">): boolean {
  return dapp.observedTransactions !== null && dapp.observedTransactions > 0;
}

export function dappLogo(slug: string): string {
  return `https://icons.llama.fi/${slug}.jpg`;
}

export function tableDapp(dapp: TrackedDapp, period: EpochPeriod | null, liveEpoch: number | null) {
  return {
    id: dapp.slug, slug: dapp.slug, name: dapp.name, category: dapp.category,
    subCategory: dapp.subCategory, logo: dappLogo(dapp.slug), link: dapp.website,
    hasRecordedData: hasRecordedActivity(dapp),
    ...epochMetrics(dapp.slug, period),
    ...sixEpochMetrics(dapp.slug, period),
    liveTransactions: dapp.observedEpoch === liveEpoch && typeof dapp.observedTxEpoch === "number" ? dapp.observedTxEpoch : null,
  };
}
