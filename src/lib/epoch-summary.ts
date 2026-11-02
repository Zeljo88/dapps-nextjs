import type { HistoryData } from "./analytics";

type Epoch = HistoryData["epochs"][number];
export interface EpochPeriod {
  current: Epoch;
  previous: Epoch | null;
  window: Epoch[];
}

export function selectEpochPeriod(history: HistoryData | null, registryDigest: string, now = Date.now() / 1000): EpochPeriod | null {
  if (!history || history.registryDigest !== registryDigest || history.aggregation !== "epoch" || !Array.isArray(history.epochs)) return null;
  const epochs = history.epochs.filter(epoch => epoch && epoch.validation?.passed === true && Number.isInteger(epoch.epoch)
    && Number.isFinite(epoch.startTime) && Number.isFinite(epoch.endTime) && Array.isArray(epoch.dapps)
    && epoch.endTime <= now && epoch.endTime > epoch.startTime);
  const current = [...epochs].sort((a, b) => b.epoch - a.epoch)[0];
  if (!current) return null;
  const previous = epochs.find(epoch => epoch.epoch === current.epoch - 1 && epoch.endTime === current.startTime) ?? null;
  const window: Epoch[] = [];
  for (let offset = 0; offset < 6; offset++) {
    const next = epochs.find(epoch => epoch.epoch === current.epoch - offset);
    if (!next || (window.length && next.endTime !== window[window.length - 1].startTime)) break;
    window.push(next);
  }
  return { current, previous, window: window.length === 6 ? window.reverse() : [] };
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

export function sixEpochMetrics(slug: string, period: EpochPeriod | null) {
  const empty = { windowTransactions: null, windowWallets: null, windowCoverage: null };
  if (!period || period.window.length !== 6) return empty;
  const rows = period.window.map(epoch => epoch.dapps.find(dapp => dapp?.slug === slug));
  const transactions = rows.map(dapp => count(dapp?.transactions));
  const wallets = rows.map(dapp => count(dapp?.activeWallets));
  const candidates = rows.map(dapp => count(dapp?.walletActivity?.candidateOrderOutputs));
  const identified = rows.map(dapp => count(dapp?.walletActivity?.attributedOrderOutputs));
  const totalCandidates = candidates.reduce<number>((sum,value) => sum + (value ?? 0), 0);
  const totalIdentified = identified.reduce<number>((sum,value) => sum + (value ?? 0), 0);
  const hasCoverage = candidates.every((value,index) => value !== null && identified[index] !== null && identified[index]! <= value);
  return {
    windowTransactions: transactions.every(value => value !== null) ? transactions.reduce<number>((sum,value) => sum + (value ?? 0), 0) : null,
    windowWallets: wallets.every(value => value !== null) ? wallets.reduce<number>((sum,value) => sum + (value ?? 0), 0) / 6 : null,
    windowCoverage: hasCoverage ? (totalCandidates ? Math.round(totalIdentified / totalCandidates * 10000) / 100 : 100) : null,
  };
}

export function directoryPeriod(period: EpochPeriod | null, liveEpoch: number | null, liveSince: number | null) {
  return {
    liveEpoch, liveSince, completedEpoch: period?.current.epoch ?? null, previousEpoch: period?.previous?.epoch ?? null,
    windowStartEpoch: period?.window[0]?.epoch ?? null, windowEndEpoch: period?.window[5]?.epoch ?? null,
    windowStartTime: period?.window[0]?.startTime ?? null, windowEndTime: period?.window[5]?.endTime ?? null,
  };
}
