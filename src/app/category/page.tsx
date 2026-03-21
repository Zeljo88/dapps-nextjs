import Link from "next/link";
import type { Metadata } from "next";
import {
  fetchDapps,
  fetchCategories,
  fmt,
  categorySlugMap,
  categoryDisplayName,
  categoryToSlug,
  CATEGORY_COLORS,
} from "@/lib/api";

export const revalidate = 300;

const BASE = "https://dappsoncardano.com";

const CATEGORY_ICONS: Record<string, string> = {
  defi: "📊",
  nft: "🖼️",
  marketplace: "🏪",
  gaming: "🎮",
  community: "🤝",
  stablecoin: "💵",
  wallet: "👛",
  infrastructure: "⚙️",
  "nft-minting": "🎨",
};

const CATEGORY_DESC: Record<string, string> = {
  defi: "DEXes, lending, yield protocols",
  nft: "Digital collectibles and art",
  marketplace: "Buy, sell, and trade NFTs",
  gaming: "Play-to-earn blockchain games",
  community: "Governance and social platforms",
  stablecoin: "Price-stable native assets",
  wallet: "Advanced self-custody solutions",
  infrastructure: "Layer 2, blockchain & mobile",
  "nft-minting": "Create and launch collections",
};

export const metadata: Metadata = {
  title: "Cardano DApp Categories | DApps on Cardano",
  description:
    "Browse all Cardano DApp categories — DeFi, NFT, Marketplace, Gaming, and more. Find the best DApps by category with real-time TVL and volume data.",
  alternates: { canonical: `${BASE}/category` },
  openGraph: {
    title: "Cardano DApp Categories | DApps on Cardano",
    description: "Browse all Cardano DApp categories with real-time TVL and volume data.",
    url: `${BASE}/category`,
    type: "website",
  },
};

export default async function CategoryIndexPage() {
  // Fetch all dApps once to compute per-slug TVL and counts
  const allDapps = await fetchDapps();

  // Compute stats per slug
  const slugStats: Record<string, { count: number; tvl: number }> = {};
  for (const [slug, apiCats] of Object.entries(categorySlugMap)) {
    const matching = allDapps.filter(
      (d: any) =>
        apiCats.includes(d.category) &&
        (d.tvl > 0 || d.trxCount > 0 || d.volume30d > 0)
    );
    slugStats[slug] = {
      count: matching.length,
      tvl: matching.reduce((s: number, d: any) => s + (d.tvl || 0), 0),
    };
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Cardano DApp Categories",
    "description":
      "Browse all Cardano DApp categories — DeFi, NFT, Marketplace, Gaming, and more.",
    "url": `${BASE}/category`,
    "numberOfItems": Object.keys(categorySlugMap).length,
    "itemListElement": Object.keys(categorySlugMap).map((slug, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": categoryDisplayName[slug],
      "url": `${BASE}/category/${slug}`,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "DApps on Cardano", "item": BASE },
      { "@type": "ListItem", "position": 2, "name": "Categories", "item": `${BASE}/category` },
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
        <span style={{ color: "var(--text-primary)" }}>Categories</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", marginBottom: 10 }}>
          Cardano DApp Categories
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 600, lineHeight: 1.6 }}>
          Explore {Object.keys(categorySlugMap).length} categories of DApps built on Cardano — from DeFi protocols and NFT marketplaces to games and infrastructure.
        </p>
      </div>

      {/* Category grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 16,
      }}>
        {Object.keys(categorySlugMap).map(slug => {
          const displayName = categoryDisplayName[slug];
          const icon = CATEGORY_ICONS[slug] || "📦";
          const desc = CATEGORY_DESC[slug] || "";
          const stats = slugStats[slug] ?? { count: 0, tvl: 0 };
          // Pick a representative color from the first API category
          const firstApiCat = categorySlugMap[slug][0];
          const color = CATEGORY_COLORS[firstApiCat] || "#6b7280";

          return (
            <Link key={slug} href={`/category/${slug}`} style={{ textDecoration: "none" }}>
              <div className="card category-card" style={{
                padding: "22px 24px",
                transition: "all 0.15s",
                cursor: "pointer",
                borderLeft: `3px solid ${color}`,
              }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>{icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
                    {displayName}
                  </span>
                </div>

                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
                  {desc}
                </p>

                <div style={{ display: "flex", gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600,
                      textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>DApps</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color }}>{stats.count}</div>
                  </div>
                  {stats.tvl > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600,
                        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>TVL</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                        {fmt(stats.tvl)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
