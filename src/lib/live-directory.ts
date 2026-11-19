import type { IndexerStatus, TrackedDapp } from "./analytics";
import type { EpochTvl } from "./tvl-summary";
import type { tableDapp } from "./dapp-view";
import { currentSnapshotIsFresh } from "./feed-freshness.ts";

export interface LiveDirectorySnapshot {
  generatedAt: number;
  status: IndexerStatus;
  dapps: Pick<TrackedDapp, "slug" | "observedEpoch" | "observedTxEpoch" | "epochRecordedSince">[];
  currentTvl: Record<string, EpochTvl | null>;
}

export function usableLiveSnapshot(snapshot: LiveDirectorySnapshot | null, registryDigest: string | undefined, now: number) {
  return snapshot && registryDigest && snapshot.status?.registryDigest === registryDigest
    && Array.isArray(snapshot.dapps) && currentSnapshotIsFresh(snapshot.generatedAt, now) ? snapshot : null;
}

export function mergeLiveRows(rows: ReturnType<typeof tableDapp>[], snapshot: LiveDirectorySnapshot | null, now: number) {
  return rows.map(row => {
    const live = snapshot?.dapps.find(dapp => dapp.slug === row.slug);
    const tvl = snapshot?.currentTvl?.[row.slug] ?? row.currentTvl;
    const point = tvl?.current;
    return { ...row, observedEpoch: live?.observedEpoch ?? null,
      liveTransactions: typeof live?.observedTxEpoch === "number" && Number.isFinite(live.observedTxEpoch) && live.observedTxEpoch >= 0 ? live.observedTxEpoch : null,
      liveSince: live?.epochRecordedSince ?? null,
      currentTvl: point && point.observedAt <= now && now - point.observedAt <= 86400
        ? { ...tvl, current: { ...point, epochEnd: now } } : null,
    };
  });
}
