import type { tableDapp } from "./dapp-view";
import type { directoryPeriod } from "./epoch-summary";

export type DirectoryView = "completed" | "six" | "current";

export function viewDapp(dapp: ReturnType<typeof tableDapp>, view: DirectoryView, period: ReturnType<typeof directoryPeriod>) {
  if (view === "completed") return dapp;
  if (view === "six") return {
    ...dapp, epochTransactions: dapp.windowTransactions, epochWallets: dapp.windowWallets,
    previousTransactions: dapp.windowPreviousTransactions, previousWallets: dapp.windowPreviousWallets,
    txGrowth: dapp.windowTxGrowth, walletGrowth: dapp.windowWalletGrowth, attributionPercent: dapp.windowCoverage,
  };
  return {
    ...dapp, epochTransactions: period.liveAvailable && dapp.observedEpoch === period.currentEpoch ? dapp.liveTransactions : null,
    liveSince: period.liveAvailable && dapp.observedEpoch === period.currentEpoch ? dapp.liveSince : null,
    epochWallets: null, previousTransactions: null, previousWallets: null,
    txGrowth: null, walletGrowth: null, attributionPercent: null, tvl: dapp.currentTvl,
  };
}
