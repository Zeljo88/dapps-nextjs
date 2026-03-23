import { fetchDapp, fmt, fmtNum, toSlug } from "@/lib/api";
import CategoryBadge from "@/components/CategoryBadge";
import Link from "next/link";
import DAppTabs from "@/components/DAppTabs";
import type { Metadata } from "next";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const dapp = await fetchDapp(id);
    const tvlStr = dapp.tvl > 0 ? ` with TVL ${fmt(dapp.tvl)}` : "";
    const volStr = dapp.volume30d > 0 ? ` and 30d volume ${fmt(dapp.volume30d)}` : "";

    const isThin =
      dapp.tvl === 0 &&
      dapp.trxCount === 0 &&
      dapp.volume30d === 0 &&
      !dapp.description;

    const description = dapp.description
      ? `${dapp.description} Track ${dapp.name} TVL, volume and transactions on DApps on Cardano.`
      : `${dapp.name} is a ${dapp.category} DApp on Cardano${tvlStr}${volStr}. Track real-time TVL, volume, transactions and analytics.`;

    return {
      title: `${dapp.name} on Cardano — DApp Analytics`,
      description,
      robots: isThin
        ? { index: false, follow: true }
        : { index: true, follow: true },
      alternates: { canonical: `https://dappsoncardano.com/dapp/${dapp.slug ?? toSlug(dapp.name)}` },
      openGraph: {
        title: `${dapp.name} — Cardano ${dapp.category} DApp Analytics`,
        description,
        url: `https://dappsoncardano.com/dapp/${dapp.slug ?? toSlug(dapp.name)}`,
        type: "website",
      },
    };
  } catch {
    return { title: "DApp Not Found" };
  }
}

export default async function DAppPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let dapp;
  try {
    dapp = await fetchDapp(id);
  } catch (e) {
    console.error(`[DApp page] Failed to fetch dapp ${id}:`, e);
    return (
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h2 style={{ color: "var(--text-primary)", marginBottom: 8 }}>DApp Not Found</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
            We couldn&apos;t find a DApp with that ID.
          </p>
          <Link href="/" style={{ color: "var(--accent)", textDecoration: "none" }}>
            ← Back to DApps
          </Link>
        </div>
      </main>
    );
  }

  // JSON-LD structured data
  const dappUrl = `https://dappsoncardano.com/dapp/${dapp.slug ?? toSlug(dapp.name)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": dapp.name,
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Cardano Blockchain",
    "url": dapp.link,
    "description": dapp.description || `${dapp.name} is a ${dapp.category} DApp on Cardano`,
    "offers": dapp.tvl > 0 ? {
      "@type": "Offer",
      "price": dapp.tvl.toFixed(0),
      "priceCurrency": "USD",
      "description": "Total Value Locked"
    } : undefined,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "DApps on Cardano",
        "item": "https://dappsoncardano.com",
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": dapp.name,
        "item": dappUrl,
      },
    ],
  };

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {/* Breadcrumb */}
      <div style={{ marginBottom: 24, fontSize: 14, color: "var(--text-muted)" }}>
        <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
          DApps
        </Link>
        <span style={{ margin: "0 8px" }}>›</span>
        <span style={{ color: "var(--text-primary)" }}>{dapp.name}</span>
      </div>

      {/* Header */}
      <div className="card" style={{ padding: "28px 32px", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Logo */}
          {dapp.logo ? (
            <img src={dapp.logo} alt={dapp.name} width={64} height={64}
              style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover", flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: 16, flexShrink: 0,
              background: "linear-gradient(135deg, #8b5cf620, #3b82f620)",
              border: "1px solid var(--border-light)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, fontWeight: 700, color: "#8b5cf6",
            }}>
              {dapp.name.charAt(0)}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)" }}>
                {dapp.name}
              </h1>
              <CategoryBadge category={dapp.category} />
              {dapp.subCategory && dapp.subCategory !== dapp.category && (
                <span style={{ fontSize: 12, color: "var(--text-muted)", padding: "2px 8px",
                  border: "1px solid var(--border)", borderRadius: 999 }}>
                  {dapp.subCategory}
                </span>
              )}
              {dapp.audits > 0 && (
                <span style={{ fontSize: 12, fontWeight: 600, color: "#10b981", padding: "2px 10px",
                  border: "1px solid #10b98140", borderRadius: 999, background: "#10b98110",
                  display: "inline-flex", alignItems: "center", gap: 4 }}>
                  🛡️ Audited
                  {dapp.auditLinks?.length > 0 && dapp.auditLinks.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      style={{ color: "#10b981", fontSize: 11, opacity: 0.8 }}>
                      [{i + 1}]
                    </a>
                  ))}
                </span>
              )}
            </div>
            {dapp.description && (
              <p style={{ color: "var(--text-secondary)", fontSize: 14, maxWidth: 700, lineHeight: 1.6 }}>
                {dapp.description}
              </p>
            )}

            {/* Links */}
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              {dapp.link && (
                <a href={dapp.link} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  🌐 Website
                </a>
              )}
              {dapp.twitter && (
                <a href={dapp.twitter} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, borderColor: "#1d9bf040" }}>
                  𝕏 Twitter
                </a>
              )}
              {dapp.discord && (
                <a href={dapp.discord} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, borderColor: "#5865f240" }}>
                  💬 Discord
                </a>
              )}
              {dapp.llamaUrl && (
                <a href={dapp.llamaUrl} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, borderColor: "#10b98140" }}>
                  📈 DeFiLlama
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
        <MiniStat label="TVL" value={dapp.tvl > 0 ? fmt(dapp.tvl) : "—"} color="#8b5cf6"
          change1d={dapp.change1d} change7d={dapp.change7d} />
        <MiniStat label="30d Volume" value={dapp.volume30d > 0 ? fmt(dapp.volume30d) : "—"} color="#10b981" />
        <MiniStat label="7d Volume" value={dapp.volume7d > 0 ? fmt(dapp.volume7d) : "—"} color="#06b6d4" />
        <MiniStat label="Tx Count" value={dapp.trxCount > 0 ? fmtNum(dapp.trxCount) : "—"} color="#3b82f6" />
        <MiniStat label="24h Transactions" value={dapp.tx24h > 0 ? fmtNum(dapp.tx24h) : "—"} color="#06b6d4" />
        <MiniStat label="7d Transactions" value={dapp.tx7d > 0 ? fmtNum(dapp.tx7d) : "—"} color="#0ea5e9" />
        {dapp.activeUsers24h > 0 && (
          <MiniStat label="Active Users (24h)" value={fmtNum(dapp.activeUsers24h)} color="#ec4899" />
        )}
        <MiniStat label="Scripts" value={`${dapp.scriptCount}`} color="#f59e0b" />
        {dapp.hasYields && (
          <MiniStat label="Yield Pools" value={`${dapp.yields.length}`} color="#f97316" />
        )}
      </div>

      {/* Tabs: Overview / Yields / Scripts */}
      <DAppTabs dapp={dapp} />
    </main>
  );
}

function MiniStat({ label, value, color, change1d, change7d }: {
  label: string; value: string; color: string; change1d?: number; change7d?: number;
}) {
  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {(change1d !== undefined || change7d !== undefined) && (
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          {change1d !== undefined && change1d !== 0 && (
            <span style={{ fontSize: 12, fontWeight: 600, color: change1d > 0 ? "#10b981" : "#ef4444" }}>
              {change1d > 0 ? "▲" : "▼"} {Math.abs(change1d).toFixed(1)}% 24h
            </span>
          )}
          {change7d !== undefined && change7d !== 0 && (
            <span style={{ fontSize: 12, fontWeight: 600, color: change7d > 0 ? "#10b981" : "#ef4444" }}>
              {change7d > 0 ? "▲" : "▼"} {Math.abs(change7d).toFixed(1)}% 7d
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 12px", borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: 13, fontWeight: 500,
  color: "var(--text-secondary)",
  textDecoration: "none",
  transition: "all 0.15s",
};
