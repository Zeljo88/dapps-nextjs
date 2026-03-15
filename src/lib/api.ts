const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://20.79.10.28";

export async function fetchDapps(category?: string) {
  const url = category
    ? `${API_BASE}/dapps/list-dapps?category=${encodeURIComponent(category)}`
    : `${API_BASE}/dapps/list-dapps`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Failed to fetch dapps");
  return res.json();
}

export async function fetchDapp(id: string) {
  const res = await fetch(`${API_BASE}/dapps/find-dapp/${id}`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("DApp not found");
  return res.json();
}

export async function fetchGlobalStats() {
  const res = await fetch(`${API_BASE}/global/stats`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function fetchEcosystem() {
  const res = await fetch(`${API_BASE}/global/ecosystem`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error("Failed to fetch ecosystem");
  return res.json();
}

export async function fetchCategories() {
  const res = await fetch(`${API_BASE}/dapps/categories`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

export function fmt(n: number, decimals = 2): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(decimals)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export const CATEGORY_COLORS: Record<string, string> = {
  DEFI: "#8b5cf6",
  MARKETPLACE: "#3b82f6",
  COLLECTION: "#10b981",
  GAMING: "#f59e0b",
  COMMUNITY: "#ec4899",
  STABLECOIN: "#06b6d4",
  LAYER_2: "#f97316",
  BLOCKCHAIN: "#84cc16",
  UNKNOWN: "#6b7280",
  TOKEN_DISTRIBUTION: "#a78bfa",
  NFT_MINTING_PLATFORM: "#34d399",
  SMART_WALLET: "#fb923c",
  MOBILE_NETWORK: "#94a3b8",
};
