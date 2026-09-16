export function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function fmt(n: number | null | undefined, decimals = 2): string {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(decimals)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function fmtNum(n: number | null | undefined): string {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export const categorySlugMap: Record<string, string[]> = {
  defi: ["DEFI"],
  nft: ["COLLECTION"],
  marketplace: ["MARKETPLACE"],
  gaming: ["GAMING"],
  community: ["COMMUNITY"],
  stablecoin: ["STABLECOIN"],
  wallet: ["SMART_WALLET"],
  infrastructure: ["LAYER_2", "BLOCKCHAIN", "MOBILE_NETWORK"],
  "nft-minting": ["NFT_MINTING_PLATFORM"],
};

export const categoryDisplayName: Record<string, string> = {
  defi: "DeFi",
  nft: "NFT & Collections",
  marketplace: "Marketplace",
  gaming: "Gaming",
  community: "Community",
  stablecoin: "Stablecoin",
  wallet: "Smart Wallet",
  infrastructure: "Infrastructure",
  "nft-minting": "NFT Minting",
};

export const categoryToSlug: Record<string, string> = {
  DEFI: "defi",
  COLLECTION: "nft",
  MARKETPLACE: "marketplace",
  GAMING: "gaming",
  COMMUNITY: "community",
  STABLECOIN: "stablecoin",
  SMART_WALLET: "wallet",
  LAYER_2: "infrastructure",
  BLOCKCHAIN: "infrastructure",
  MOBILE_NETWORK: "infrastructure",
  NFT_MINTING_PLATFORM: "nft-minting",
};

export interface DappSeoRecord {
  name?: string;
  slug?: string;
  tvl?: number;
  trxCount?: number;
  volume30d?: number;
  description?: string;
}

export interface YieldRecord {
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  stablecoin: boolean;
}

export interface DappRelease {
  releaseKey: string;
  releaseName?: string;
  releaseNumber: number;
}

export interface DappScript {
  name?: string;
  purpose?: string;
  scriptHash?: string;
  contractAddress?: string;
  plutusVersion?: string;
  txCount: number;
  cardanoscanUrl?: string;
}

export interface DappRecord extends DappSeoRecord {
  id?: string | number;
  name: string;
  category: string;
  subCategory?: string;
  tvl: number;
  volume30d: number;
  volume7d: number;
  trxCount: number;
  tx24h: number;
  tx7d: number;
  activeUsers24h: number;
  change1d: number;
  change7d: number;
  logo?: string;
  link?: string;
  twitter?: string;
  discord?: string;
  llamaUrl?: string;
  audits: number;
  auditLinks?: string[];
  github?: string;
  scriptCount: number;
  hasYields: boolean;
  yields: YieldRecord[];
  scripts: DappScript[];
  releases: DappRelease[];
  features: string[];
}

export interface GlobalStats {
  adaPrice: number;
  totalTvl: number;
  totalVolume30d: number;
  totalVolume24h: number;
  totalActiveUsers24h: number;
  totalTxCount: number;
  totalDapps: number;
  currentEpoch: number;
}

export interface EcosystemData {
  tvlLeaderboard: Array<{ name: string; category: string; tvl: number }>;
  volumeLeaderboard: Array<{ name: string; volume30d: number }>;
  categoryBreakdown: Array<{ category: string; count: number }>;
}

export function isIndexableDapp(dapp: unknown): dapp is DappSeoRecord {
  if (!dapp || typeof dapp !== "object") return false;
  const record = dapp as DappSeoRecord;
  return Boolean(
    typeof record.name === "string" &&
    record.name.trim() &&
    ((record.tvl || 0) > 0 ||
      (record.trxCount || 0) > 0 ||
      (record.volume30d || 0) > 0 ||
      (typeof record.description === "string" && record.description.trim()))
  );
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
