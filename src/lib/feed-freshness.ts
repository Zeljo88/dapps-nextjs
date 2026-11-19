import type { IndexerStatus } from "./analytics";

// Match the collector's 180-second freshness bound, including cached responses.
export function feedIsFresh(status: IndexerStatus | null | undefined, now = Date.now() / 1000): boolean {
  return status?.fresh === true && status.phase === "running"
    && typeof status.lastReceivedAt === "number" && Number.isFinite(status.lastReceivedAt)
    && now >= status.lastReceivedAt && now - status.lastReceivedAt < 180
    && typeof status.checkpoint?.time === "number" && Number.isFinite(status.checkpoint.time)
    && now >= status.checkpoint.time && now - status.checkpoint.time < 180
    && typeof status.lagBlocks === "number" && status.lagBlocks >= 0 && status.lagBlocks <= 10;
}

export function currentSnapshotIsFresh(generatedAt: number, now = Date.now() / 1000): boolean {
  return Number.isFinite(generatedAt) && generatedAt <= now && now - generatedAt < 45;
}
