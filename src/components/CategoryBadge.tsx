import { CATEGORY_COLORS } from "@/lib/api";

const LABELS: Record<string, string> = {
  DEFI: "DeFi",
  MARKETPLACE: "Marketplace",
  COLLECTION: "NFT",
  GAMING: "Gaming",
  COMMUNITY: "Community",
  STABLECOIN: "Stablecoin",
  LAYER_2: "Layer 2",
  BLOCKCHAIN: "Blockchain",
  TOKEN_DISTRIBUTION: "Token",
  NFT_MINTING_PLATFORM: "NFT Mint",
  SMART_WALLET: "Wallet",
  MOBILE_NETWORK: "Mobile",
  UNKNOWN: "Other",
};

export default function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] || "#6b7280";
  const label = LABELS[category] || category;
  return (
    <span className="badge" style={{
      background: `${color}20`,
      color: color,
      border: `1px solid ${color}40`,
    }}>{label}</span>
  );
}
