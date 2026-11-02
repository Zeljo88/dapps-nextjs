import type { TrackedDapp } from "./analytics";
import { epochMetrics, type EpochPeriod } from "./epoch-summary";

export function hasRecordedActivity(dapp: Pick<TrackedDapp, "observedTransactions">): boolean {
  return dapp.observedTransactions !== null && dapp.observedTransactions > 0;
}

export function dappLogo(slug: string): string {
  return `https://icons.llama.fi/${slug}.jpg`;
}

export function tableDapp(dapp: TrackedDapp, period: EpochPeriod | null) {
  return {
    id: dapp.slug, slug: dapp.slug, name: dapp.name, category: dapp.category,
    subCategory: dapp.subCategory, logo: dappLogo(dapp.slug), link: dapp.website,
    hasRecordedData: hasRecordedActivity(dapp),
    ...epochMetrics(dapp.slug, period),
  };
}
