import "server-only";
import { cache } from "react";

export interface TrackedDapp {
  slug: string; name: string; category: string; description: string; website: string;
  coverage: "partial"; source: string; sourceDocumentation?: string; mappingReviewedOn?: string;
  scripts: { role: string; hash: string }[];
  observedTransactions: number | null; observedTx24h: number | null;
  recordedSince: number | null; lastObservedActivity: number | null;
  confirmationDepth: number; fresh: boolean;
}
export interface IndexerStatus {
  fresh: boolean; phase: string; startedAt: number | null; lastReceivedAt: number | null;
  checkpoint: { height: number; slot: number; time: number; epoch: number; hash: string } | null;
  watchedScripts: number; lagBlocks: number | null; registryDigest: string;
  counts: { blocks: number; transactions: number }; methodology: string;
}
export interface ContractEvent {
  tx: string; slot: number; height: number; time: number; script: string; kind: string; ref: string;
}
async function read<T>(path: string): Promise<T> {
  const origin = process.env.API_URL?.trim() || "http://127.0.0.1:8000";
  const url = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (process.env.NODE_ENV === "production" && (!process.env.API_URL || (url.protocol !== "https:" && !local))) throw new Error("API_URL must specify the HTTPS analytics origin");
  const response = await fetch(`${origin.replace(/\/+$/, "")}${path}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Analytics request failed (${response.status})`);
  return response.json();
}
export const fetchAnalytics = cache(async () => {
  const [status, dapps] = await Promise.all([read<IndexerStatus>("/v1/status"), read<TrackedDapp[]>("/v1/dapps")]);
  if (!Array.isArray(dapps) || typeof status.fresh !== "boolean") throw new Error("Invalid analytics response");
  return { status, dapps };
});
export function fetchEvents(slug: string) { return read<{ events: ContractEvent[] }>(`/v1/dapps/${encodeURIComponent(slug)}/events?limit=30`); }
export function dateTime(value: number | null): string {
  return value === null ? "Not available" : new Date(value * 1000).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";
}
export function count(value: number | null): string { return value === null ? "—" : value.toLocaleString("en-US"); }
