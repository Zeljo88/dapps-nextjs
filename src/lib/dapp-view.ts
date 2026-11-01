import type { TrackedDapp } from "./analytics";

export function hasRecordedActivity(dapp: Pick<TrackedDapp, "observedTransactions">): boolean {
  return dapp.observedTransactions !== null && dapp.observedTransactions > 0;
}

export function dappLogo(slug: string): string {
  return `https://icons.llama.fi/${slug}.jpg`;
}

export function tableDapp(dapp: TrackedDapp) {
  return {
    id: dapp.slug, slug: dapp.slug, name: dapp.name, category: dapp.category,
    subCategory: dapp.subCategory, logo: dappLogo(dapp.slug), link: dapp.website,
    hasRecordedData: hasRecordedActivity(dapp),
    tvl: null, volume30d: null, change1d: null, activeUsers24h: null, audits: null,
    trxCount: dapp.observedTransactions, tx24h: dapp.observedTx24h,
  };
}
