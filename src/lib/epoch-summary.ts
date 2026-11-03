import type { HistoryData, IndexerStatus } from "./analytics";

type Epoch = HistoryData["epochs"][number];
export interface EpochPeriod {
  current: Epoch;
  previous: Epoch | null;
  window: Epoch[];
  previousWindow: Epoch[];
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
  const previousWindow: Epoch[] = [];
  if (window.length === 6) {
    let boundary = window[5].startTime;
    for (let offset = 6; offset < 12; offset++) {
      const next = epochs.find(epoch => epoch.epoch === current.epoch - offset && epoch.endTime === boundary);
      if (!next) break;
      previousWindow.push(next);
      boundary = next.startTime;
    }
  }
  return { current, previous, window: window.length === 6 ? window.reverse() : [], previousWindow: previousWindow.length === 6 ? previousWindow.reverse() : [] };
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
  const previousTransactions = count(previous?.transactions);
  const previousWallets = count(previous?.activeWallets);
  const attribution = current?.walletActivity?.attributionPercent;
  return {
    epochTransactions, epochWallets, previousTransactions, previousWallets,
    txGrowth: percentageChange(epochTransactions, previousTransactions),
    walletGrowth: percentageChange(epochWallets, previousWallets),
    attributionPercent: epochWallets !== null && typeof attribution === "number" && Number.isFinite(attribution) && attribution >= 0 && attribution <= 100 ? attribution : null,
  };
}

export function sixEpochMetrics(slug: string, period: EpochPeriod | null) {
  return windowMetrics(slug, period?.window ?? []);
}

function windowMetrics(slug: string, epochs: Epoch[]) {
  const empty = { windowTransactions: null, windowWallets: null, windowCoverage: null };
  if (epochs.length !== 6) return empty;
  const rows = epochs.map(epoch => epoch.dapps.find(dapp => dapp?.slug === slug));
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

export function sixEpochComparison(slug: string, period: EpochPeriod | null) {
  const current = sixEpochMetrics(slug, period);
  const previous = windowMetrics(slug, period?.previousWindow ?? []);
  return {
    ...current, windowPreviousTransactions: previous.windowTransactions, windowPreviousWallets: previous.windowWallets,
    windowTxGrowth: percentageChange(current.windowTransactions, previous.windowTransactions),
    windowWalletGrowth: percentageChange(current.windowWallets, previous.windowWallets),
  };
}

export function directoryPeriod(period: EpochPeriod | null, status?: IndexerStatus, now = Date.now() / 1000) {
  // Derive the current five-day interval from our validated mainnet history.
  // A stale checkpoint must never make the previous epoch look current.
  const duration = period ? period.current.endTime - period.current.startTime : 0;
  const offset = duration === 432000 && now >= period!.current.endTime ? Math.floor((now - period!.current.endTime) / duration) : null;
  const currentEpoch = offset === null ? null : period!.current.epoch + 1 + offset;
  const currentStartTime = offset === null ? null : period!.current.endTime + offset * duration;
  const currentEndTime = currentStartTime === null ? null : currentStartTime + duration;
  return {
    completedEpoch: period?.current.epoch ?? null, previousEpoch: period?.previous?.epoch ?? null,
    startTime: period?.current.startTime ?? null, endTime: period?.current.endTime ?? null,
    windowStartEpoch: period?.window[0]?.epoch ?? null, windowEndEpoch: period?.window[5]?.epoch ?? null,
    windowStartTime: period?.window[0]?.startTime ?? null, windowEndTime: period?.window[5]?.endTime ?? null,
    previousWindowStartEpoch: period?.previousWindow[0]?.epoch ?? null, previousWindowEndEpoch: period?.previousWindow[5]?.epoch ?? null,
    currentEpoch, currentStartTime, currentEndTime, asOf: now,
    liveAvailable: currentEpoch !== null && status?.fresh === true && status.checkpoint?.epoch === currentEpoch,
  };
}
