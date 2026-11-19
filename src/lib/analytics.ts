import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { feedIsFresh } from "./feed-freshness";

export interface TrackedDapp {
  slug: string; name: string; category: string; subCategory?: string; description: string; website: string;
  coverage: "partial"; source: string; sourceDocumentation?: string; mappingReviewedOn?: string;
  scripts: { role: string; hash: string }[];
  observedTransactions: number | null; observedTx24h: number | null;
  observedEpoch?: number | null; observedTxEpoch?: number | null; epochRecordedSince?: number | null;
  recordedSince: number | null; lastObservedActivity: number | null;
  confirmationDepth: number; fresh: boolean;
}
export interface IndexerStatus {
  snapshotAt?: number;
  fresh: boolean; phase: string; startedAt: number | null; lastReceivedAt: number | null;
  checkpoint: { height: number; slot: number; time: number; epoch: number; hash: string } | null;
  watchedScripts: number; lagBlocks: number | null; registryDigest: string;
  counts: { blocks: number; transactions: number }; methodology: string;
}
export interface ContractEvent {
  tx: string; slot: number; height: number; time: number; script: string; kind: string; ref: string;
}
export interface HistoryData {
  registryDigest: string;
  aggregation: "epoch";
  coverage: "partial";
  epochs: { epoch: number; startTime: number; endTime: number; dapps: { slug: string; name: string; transactions: number;
    activeWallets?: number; walletActivity?: { method: string; candidateOrderOutputs: number; attributedOrderOutputs: number;
      scriptControlledOrderOutputs: number; unrecognizedOrderOutputs: number; unavailableDatumOrderOutputs: number;
      attributionPercent: number; ambiguousPaymentKeys: number } }[];
    validation: { passed: boolean; checkedAt: string; blocksReplayed: number; independentTransactionSamples: number; chainTransactionsInspected?: number } }[];
}
export interface OwnMetrics {
  source: "own-cardano-node"; registryDigest: string; slug: string; generatedAt: number; confirmationDepth: number;
  epochs: { epoch: number; startTime: number; endTime: number; transactions: number; activeWallets: number | null;
    orderOutputsCreated: number | null; networkTransactions: number | null; transactionSharePercent: number | null;
    walletVersions: { version: string; activeWallets: number }[] }[];
  recorded: null | { fromTime: number; throughTime: number; confirmedHeight: number; fresh: boolean;
    transactions: number; networkFeesLovelace: string; averageNetworkFeeAda: string | null;
    outputsCreated: number; outputsSpent: number; versionTransactions: { version: string; transactions: number }[];
    observedLovelace: string; observedUnspentOutputs: number; assetCount: number; assetsLimit: number;
    assets: { policyId: string; assetNameHex: string; quantity: string }[] };
}
async function read<T>(path: string, revalidate = 0): Promise<T> {
  const origin = process.env.API_URL?.trim() || "http://127.0.0.1:8000";
  const url = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (process.env.NODE_ENV === "production" && (!process.env.API_URL || (url.protocol !== "https:" && !local))) throw new Error("API_URL must specify the HTTPS analytics origin");
  const response = await fetch(`${origin.replace(/\/+$/, "")}${path}`, {
    ...(revalidate ? { next: { revalidate } } : { cache: "no-store" as const }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Analytics request failed (${response.status})`);
  return response.json();
}
export async function fetchLiveAnalytics() {
  const [status, dapps] = await Promise.all([read<IndexerStatus>("/v1/status"), read<TrackedDapp[]>("/v1/dapps")]);
  if (!Array.isArray(dapps) || typeof status.fresh !== "boolean") throw new Error("Invalid analytics response");
  const fresh = feedIsFresh(status);
  return { status: { ...status, fresh, snapshotAt: Date.now() / 1000 }, dapps: dapps.map(dapp => ({ ...dapp, fresh: fresh && dapp.fresh })) };
}
const readCachedAnalytics = unstable_cache(fetchLiveAnalytics, ["analytics-snapshot-v1"], { revalidate: 300 });
export const fetchAnalytics = cache(readCachedAnalytics);
export function fetchEvents(slug: string) { return read<{ events: ContractEvent[] }>(`/v1/dapps/${encodeURIComponent(slug)}/events?limit=30`); }
export const fetchHistory = cache(() => read<HistoryData>("/v1/history", 300));
export const fetchDirectoryDapps = cache(() => read<TrackedDapp[]>("/v1/dapps", 3600));
export const fetchOwnMetrics = cache((slug: string) => read<OwnMetrics>(`/staging/v1/dapps/${encodeURIComponent(slug)}/metrics`, 60));
export function dateTime(value: number | null): string {
  return value === null ? "Not available" : new Date(value * 1000).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";
}
export function count(value: number | null): string { return value === null ? "—" : value.toLocaleString("en-US"); }
