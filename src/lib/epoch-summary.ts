import type { HistoryData } from "./analytics";

type Epoch = HistoryData["epochs"][number];
export interface EpochPeriod {
  current: Epoch;
  previous: Epoch | null;
}

export function selectEpochPeriod(history: HistoryData | null, registryDigest: string, now = Date.now() / 1000): EpochPeriod | null {
  if (!history || history.registryDigest !== registryDigest || history.aggregation !== "epoch" || !Array.isArray(history.epochs)) return null;
  const epochs = history.epochs.filter(epoch => epoch && epoch.validation?.passed === true && Number.isInteger(epoch.epoch)
    && Number.isFinite(epoch.startTime) && Number.isFinite(epoch.endTime) && Array.isArray(epoch.dapps)
    && epoch.endTime <= now && epoch.endTime > epoch.startTime);
  const current = [...epochs].sort((a, b) => b.epoch - a.epoch)[0];
  if (!current) return null;
  const previous = epochs.find(epoch => epoch.epoch === current.epoch - 1 && epoch.endTime === current.startTime) ?? null;
  return { current, previous };
}

function count(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function percentageChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous * 100;
}

export function epochMetrics(slug: string, period: EpochPeriod | null) {
  const current = period?.current.dapps.find(dapp => dapp?.slug === slug);
  const previous = period?.previous?.dapps.find(dapp => dapp?.slug === slug);
  const epochTransactions = count(current?.transactions);
  const epochWallets = count(current?.activeWallets);
  const attribution = current?.walletActivity?.attributionPercent;
  return {
    epochTransactions, epochWallets,
    txGrowth: percentageChange(epochTransactions, count(previous?.transactions)),
    walletGrowth: percentageChange(epochWallets, count(previous?.activeWallets)),
    attributionPercent: epochWallets !== null && typeof attribution === "number" && Number.isFinite(attribution) && attribution >= 0 && attribution <= 100 ? attribution : null,
  };
}
