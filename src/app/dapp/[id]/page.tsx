import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { count, fetchAnalytics, fetchHistory } from "@/lib/analytics";
import { hasRecordedActivity } from "@/lib/dapp-view";
import { CoverageNotice, FeedUnavailable } from "@/components/ContractAnalytics";
import CategoryBadge from "@/components/CategoryBadge";
import DappLogo from "@/components/DappLogo";
import TrackedDappTabs from "@/components/TrackedDappTabs";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchAnalytics().catch(() => null);
  const dapp = data?.dapps.find(item => item.slug === id);
  if (data && !dapp) notFound();
  return { title: dapp ? `${dapp.name} — Observed Cardano Contract Activity` : "DApp contract activity", description: dapp?.description, alternates: { canonical: `https://dappsoncardano.com/dapp/${id}` } };
}
export default async function DappPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchAnalytics().catch(() => null);
  if (!data) return <FeedUnavailable />;
  const dapp = data.dapps.find(item => item.slug === id);
  if (!dapp) notFound();
  const history = await fetchHistory().catch(() => null);
  const related = data.dapps.filter(item => item.slug !== dapp.slug && hasRecordedActivity(item));
  return <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
    <div style={{ marginBottom: 24, fontSize: 14, color: "var(--text-muted)" }}><Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}>DApps</Link><span style={{ margin: "0 8px" }}>›</span>{dapp.name}</div>
    <div className="card" style={{ padding: "28px 32px", marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <DappLogo slug={dapp.slug} name={dapp.name} />
        <div style={{ flex: 1, minWidth: 180 }}><div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}><h1 style={{ fontSize: 26, fontWeight: 800 }}>{dapp.name}</h1><CategoryBadge category={dapp.category} /><span style={{ fontSize: 12, color: "var(--text-muted)", padding: "2px 8px", border: "1px solid var(--border)", borderRadius: 999 }}>Partial coverage</span></div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, maxWidth: 700, lineHeight: 1.6 }}>{dapp.description}</p>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}><a href={dapp.website} target="_blank" rel="noopener noreferrer" style={linkStyle}>🌐 Website</a><a href={dapp.sourceDocumentation || dapp.source} target="_blank" rel="noopener noreferrer" style={linkStyle}>Contract mapping source ↗</a></div>
        </div>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 16, marginBottom: 24 }}>
      <DetailStat label="TVL" value="—" color="#8b5cf6" /><DetailStat label="30d Volume" value="—" color="#10b981" /><DetailStat label="7d Volume" value="—" color="#06b6d4" />
      <DetailStat label="Tx Count*" value={count(dapp.observedTransactions)} color="#3b82f6" /><DetailStat label="24h Transactions*" value={count(dapp.observedTx24h)} color="#06b6d4" /><DetailStat label="7d Transactions" value="—" color="#0ea5e9" /><DetailStat label="Scripts" value={count(dapp.scripts.length)} color="#f59e0b" />
    </div>
    <CoverageNotice status={data.status} compact />
    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>*Observed tx since start, with partial contract coverage. — means unavailable.</p>
    <TrackedDappTabs dapp={dapp} history={history} />
    {related.length > 0 && <section style={{ marginTop: 48 }}><h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Related DApps</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 16 }}>{related.map(item => <Link href={`/dapp/${item.slug}`} key={item.slug} style={{ textDecoration: "none" }}><div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}><DappLogo slug={item.slug} name={item.name} size={40} /><div><strong style={{ color: "var(--text-primary)", fontSize: 14 }}>{item.name}</strong><p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 5 }}>{count(item.observedTransactions)} observed transactions</p></div></div></Link>)}</div></section>}
  </main>;
}
function DetailStat({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="card" style={{ padding: "16px 20px" }} title={value === "—" ? "Unavailable in the current feed" : undefined}><div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div><div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div></div>;
}
const linkStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none" };
