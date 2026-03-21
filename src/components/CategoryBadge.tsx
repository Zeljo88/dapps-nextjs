import Link from "next/link";
import { CATEGORY_COLORS, categoryToSlug } from "@/lib/api";

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
  const slug = categoryToSlug[category];

  const style = {
    background: `${color}20`,
    color: color,
    border: `1px solid ${color}40`,
    textDecoration: "none",
  };

  if (slug) {
    return (
      <Link href={`/category/${slug}`} className="badge" style={style}>
        {label}
      </Link>
    );
  }

  return (
    <span className="badge" style={style}>{label}</span>
  );
}
