import "server-only";

import { categorySlugMap } from "@/lib/api";
import type { DappRecord, EcosystemData, GlobalStats, YieldRecord } from "@/lib/api";

const LOCAL_API_URL = "http://127.0.0.1:8000";

function isLoopback(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

function apiBase(): string {
  const configured = process.env.API_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !isLoopback(url)) {
      throw new Error("API_URL must use HTTPS for a production backend (loopback HTTP is allowed for local verification)");
    }
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("API_URL is required in production");
  }
  return LOCAL_API_URL;
}

function backendUrl(path: string): string {
  return `${apiBase()}${path}`;
}

export class DappNotFoundError extends Error {
  constructor(identifier: string) {
    super(`DApp not found: ${identifier}`);
    this.name = "DappNotFoundError";
  }
}

export class BackendResponseError extends Error {
  constructor(path: string, status: number) {
    super(`Backend request failed for ${path} (${status})`);
    this.name = "BackendResponseError";
  }
}

async function requireOk(res: Response, path: string): Promise<Response> {
  if (!res.ok) throw new BackendResponseError(path, res.status);
  return res;
}

export async function fetchDapps(category?: string): Promise<DappRecord[]> {
  const path = category
    ? `/dapps/list-dapps?category=${encodeURIComponent(category)}`
    : "/dapps/list-dapps";
  const res = await fetch(backendUrl(path), { next: { revalidate: 300 } });
  return (await requireOk(res, path)).json();
}

export async function fetchDapp(nameOrId: string): Promise<DappRecord> {
  const path = `/dapps/find-dapp/${encodeURIComponent(nameOrId)}`;
  const res = await fetch(backendUrl(path), {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) throw new DappNotFoundError(nameOrId);
  return (await requireOk(res, path)).json();
}

export async function fetchGlobalStats(): Promise<GlobalStats> {
  const path = "/global/stats";
  const res = await fetch(backendUrl(path), { next: { revalidate: 60 } });
  return (await requireOk(res, path)).json();
}

export async function fetchEcosystem(): Promise<EcosystemData> {
  const path = "/global/ecosystem";
  const res = await fetch(backendUrl(path), { next: { revalidate: 300 } });
  return (await requireOk(res, path)).json();
}

export async function fetchSlugMap(): Promise<{ name: string; slug: string }[]> {
  const path = "/dapps/slug-map";
  const res = await fetch(backendUrl(path), { next: { revalidate: 86400 } });
  return (await requireOk(res, path)).json();
}

export async function fetchCategories(): Promise<string[]> {
  const path = "/dapps/categories";
  const res = await fetch(backendUrl(path), { next: { revalidate: 3600 } });
  return (await requireOk(res, path)).json();
}

export async function fetchTvlHistory(slug: string): Promise<{ points: { date: number; tvl: number }[]; totalPoints: number }> {
  const path = `/dapps/${encodeURIComponent(slug)}/tvl-history`;
  const res = await fetch(backendUrl(path), {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  return (await requireOk(res, path)).json();
}

export async function fetchYields(): Promise<YieldRecord[]> {
  const path = "/yields";
  const res = await fetch(backendUrl(path), { next: { revalidate: 3600 } });
  return (await requireOk(res, path)).json();
}

export async function fetchDappsByCategory(slug: string): Promise<DappRecord[]> {
  const categories = categorySlugMap[slug];
  if (!categories) throw new Error(`Unknown category slug: ${slug}`);
  const results = await Promise.all(categories.map(category => fetchDapps(category)));
  return results.flat();
}
