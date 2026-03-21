import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  fetchDappsByCategory,
  fetchGlobalStats,
  fmt,
  categorySlugMap,
  categoryDisplayName,
  categoryToSlug,
} from "@/lib/api";
import DAppTable from "@/components/DAppTable";

export const revalidate = 300;

const BASE = "https://dappsoncardano.com";

// Per-category SEO copy
const CATEGORY_META: Record<string, {
  title: string;
  description: string;
  h1: string;
  intro: string;
  icon: string;
}> = {
  defi: {
    title: "Cardano DeFi DApps — TVL, Volume & Analytics | DApps on Cardano",
    description:
      "Explore DeFi DApps on Cardano with real-time TVL, volume and transaction data. Track Minswap, Liqwid Finance, SundaeSwap and more.",
    h1: "Cardano DeFi DApps",
    intro:
      "Cardano's DeFi ecosystem offers decentralized exchanges, lending protocols, and yield optimization platforms built on Plutus smart contracts. " +
      "Track real-time TVL, trading volume, and transaction counts across leading protocols like Minswap, Liqwid Finance, and SundaeSwap. " +
      "All data is sourced on-chain and updated every 5 minutes.",
    icon: "📊",
  },
  nft: {
    title: "Cardano NFT Collections — Analytics & Volume | DApps on Cardano",
    description:
      "Browse NFT collections and projects on Cardano. Discover top collections with real-time trading volume and on-chain analytics.",
    h1: "Cardano NFT & Collections",
    intro:
      "Cardano hosts a thriving NFT ecosystem with thousands of unique digital collectibles, generative art projects, and utility token collections. " +
      "Explore top collections with on-chain data including trading volume and transaction activity tracked in real time. " +
      "Cardano NFTs benefit from native asset support — no smart contracts required for basic minting.",
    icon: "🖼️",
  },
  marketplace: {
    title: "Cardano NFT Marketplaces — Volume & Listings | DApps on Cardano",
    description:
      "Discover Cardano NFT marketplaces with real-time trading volume, listings and transaction data. Compare JPG.store, CNFT.io and more.",
    h1: "Cardano NFT Marketplaces",
    intro:
      "Cardano NFT marketplaces provide platforms for buying, selling, and trading digital assets peer-to-peer with minimal fees. " +
      "Track trading volume, transaction counts, and platform activity across the top marketplaces in the ecosystem. " +
      "Cardano's eUTXO model enables trustless trades without wrapping or bridging assets.",
    icon: "🏪",
  },
  gaming: {
    title: "Cardano Blockchain Games — Play-to-Earn & Analytics | DApps on Cardano",
    description:
      "Discover blockchain games on Cardano with true on-chain asset ownership and play-to-earn mechanics. Track activity and volume.",
    h1: "Cardano Blockchain Games",
    intro:
      "Blockchain gaming on Cardano brings true ownership of in-game assets, enabling play-to-earn mechanics and transparent economies. " +
      "Games built natively on Cardano leverage native assets for items, characters, and currencies without additional smart contract overhead. " +
      "Discover active games and track their on-chain transaction volume.",
    icon: "🎮",
  },
  community: {
    title: "Cardano Community DApps — Governance & Social | DApps on Cardano",
    description:
      "Explore community-driven DApps on Cardano powering governance, social platforms, and decentralized organizations.",
    h1: "Cardano Community DApps",
    intro:
      "Community-driven DApps on Cardano power governance systems, social platforms, and decentralized autonomous organizations. " +
      "These protocols put decision-making in the hands of token holders and community members, aligned with Cardano's vision of self-governance. " +
      "Track participation and on-chain activity across the ecosystem's community layer.",
    icon: "🤝",
  },
  stablecoin: {
    title: "Cardano Stablecoins — Supply & Analytics | DApps on Cardano",
    description:
      "Track Cardano native stablecoins with real-time supply, TVL and adoption data. Includes DJED, USDA and more.",
    h1: "Cardano Stablecoins",
    intro:
      "Cardano stablecoins provide price-stable assets pegged to fiat currencies, enabling DeFi participation without volatility exposure. " +
      "Native stablecoins on Cardano benefit from the network's low transaction fees and deterministic transaction costs. " +
      "Track supply, TVL locked in stablecoin protocols, and adoption across the ecosystem.",
    icon: "💵",
  },
  wallet: {
    title: "Cardano Smart Wallets — Non-Custodial & Analytics | DApps on Cardano",
    description:
      "Discover smart wallet DApps on Cardano with advanced features like multi-sig, spending limits, and social recovery.",
    h1: "Cardano Smart Wallets",
    intro:
      "Smart wallet DApps on Cardano extend native wallet functionality with advanced security and usability features like multi-signature approvals, spending limits, and social recovery. " +
      "These protocols make self-custody safer and more accessible without sacrificing decentralization. " +
      "Track usage and transaction volume across Cardano's smart wallet ecosystem.",
    icon: "👛",
  },
  infrastructure: {
    title: "Cardano Infrastructure — Layer 2, Blockchain & Network | DApps on Cardano",
    description:
      "Explore Cardano infrastructure projects including Layer 2 scaling solutions, blockchain services, and mobile network integrations.",
    h1: "Cardano Infrastructure",
    intro:
      "Infrastructure protocols on Cardano include Layer 2 scaling solutions, foundational blockchain services, and mobile network integrations. " +
      "These projects expand Cardano's capabilities, improve scalability, and extend its reach to new user segments including mobile-first markets. " +
      "Track on-chain activity and TVL across Cardano's infrastructure layer.",
    icon: "⚙️",
  },
  "nft-minting": {
    title: "Cardano NFT Minting Platforms — Launch & Analytics | DApps on Cardano",
    description:
      "Discover NFT minting platforms on Cardano. Launch collections, set royalties, and distribute digital assets with low fees.",
    h1: "Cardano NFT Minting Platforms",
    intro:
      "NFT minting platforms on Cardano make it easy for creators to launch collections, configure royalties, and distribute digital assets to collectors. " +
      "Cardano's native asset standard enables minting without complex smart contracts, keeping costs low and transactions fast. " +
      "Track minting activity and platform usage across the Cardano creator ecosystem.",
    icon: "🎨",
  },
};

export async function generateStaticParams() {
  return Object.keys(categorySlugMap).map(slug => ({ slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const meta = CATEGORY_META[slug];
  if (!meta) return { title: "Category Not Found" };
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `${BASE}/category/${slug}` },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${BASE}/category/${slug}`,
      type: "website",
    },
  };
}

export default async function CategorySlugPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const meta = CATEGORY_META[slug];
  if (!meta) notFound();

  const [dapps, stats] = await Promise.all([
    fetchDappsByCategory(slug),
    fetchGlobalStats(),
  ]);
  const adaPrice = stats.adaPrice || 0;

  const withData = dapps.filter(d => d.tvl > 0 || d.trxCount > 0 || d.volume30d > 0);
  const totalTvl = dapps.reduce((s, d) => s + (d.tvl || 0), 0);
  const totalVol30d = dapps.reduce((s, d) => s + (d.volume30d || 0), 0);

  // Other categories for the "Explore more" section
  const otherSlugs = Object.keys(categorySlugMap).filter(s => s !== slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": meta.h1,
    "description": meta.description,
    "url": `${BASE}/category/${slug}`,
    "numberOfItems": withData.length,
    "itemListElement": withData.slice(0, 10).map((d, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": d.name,
      "url": `${BASE}/dapp/${d.slug ?? d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "DApps on Cardano", "item": BASE },
      { "@type": "ListItem", "position": 2, "name": "Categories", "item": `${BASE}/category` },
      { "@type": "ListItem", "position": 3, "name": meta.h1, "item": `${BASE}/category/${slug}` },
    ],
  };

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Breadcrumb */}
      <div style={{ marginBottom: 24, fontSize: 14, color: "var(--text-muted)" }}>
        <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}>DApps</Link>
        <span style={{ margin: "0 8px" }}>›</span>
        <Link href="/category" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Categories</Link>
        <span style={{ margin: "0 8px" }}>›</span>
        <span style={{ color: "var(--text-primary)" }}>{meta.h1}</span>
      </div>

      {/* Hero */}
      <div className="hero-banner" style={{ marginBottom: 28 }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
            <span style={{ fontSize: 36 }}>{meta.icon}</span>
            <h1 style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.2 }}>{meta.h1}</h1>
          </div>
          <p style={{ fontSize: 15, opacity: 0.85, maxWidth: 620, lineHeight: 1.6 }}>{meta.intro}</p>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 32 }}>
        <StatCard label="DApps" value={`${withData.length}`} color="#f59e0b" />
        <StatCard label="Total TVL" value={totalTvl > 0 ? fmt(totalTvl) : "—"} color="#8b5cf6" />
        <StatCard label="30d Volume" value={totalVol30d > 0 ? fmt(totalVol30d) : "—"} color="#10b981" />
      </div>

      {/* DApp table — category pre-filtered, no redundant filter buttons */}
      <DAppTable dapps={dapps} adaPrice={adaPrice} hideFilters />

      {/* Explore more categories */}
      <div style={{ marginTop: 56 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
          Explore more categories
        </h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {otherSlugs.map(s => (
            <Link key={s} href={`/category/${s}`} style={{
              padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              textDecoration: "none",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              transition: "all 0.15s",
            }}>
              {categoryDisplayName[s]}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
