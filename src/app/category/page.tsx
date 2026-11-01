import Link from "next/link";
import { fetchAnalytics } from "@/lib/analytics";
import { hasRecordedActivity } from "@/lib/dapp-view";
import { FeedUnavailable } from "@/components/ContractAnalytics";
import { categorySlugMap, categoryDisplayName, CATEGORY_COLORS } from "@/lib/api";
export const dynamic = "force-dynamic";
export const metadata = { title: "Cardano DApp Categories", description: "Browse Cardano DApp categories with recorded on-chain activity.", alternates: { canonical: "https://dappsoncardano.com/category" } };
const ICONS: Record<string,string> = { defi:"📊",nft:"🖼️",marketplace:"🏪",gaming:"🎮",community:"🤝",stablecoin:"💵",wallet:"👛",infrastructure:"⚙️","nft-minting":"🎨" };
const DESCRIPTIONS: Record<string,string> = { defi:"DEXes, lending and yield protocols",nft:"Digital collectibles and art",marketplace:"NFT marketplaces",gaming:"Blockchain games",community:"Governance and social platforms",stablecoin:"Price-stable native assets",wallet:"Self-custody solutions",infrastructure:"Blockchain infrastructure","nft-minting":"Create and launch collections" };
export default async function Categories() {
  const data = await fetchAnalytics().catch(() => null);
  if (!data) return <FeedUnavailable />;
  const dapps = data.dapps.filter(hasRecordedActivity);
  const categories = Object.entries(categorySlugMap).map(([slug, apiCategories]) => ({ slug, count: dapps.filter(d => apiCategories.includes(d.category)).length })).filter(c => c.count > 0);
  return <main style={{ maxWidth:1280,margin:"0 auto",padding:"32px 24px" }}>
    <div style={{marginBottom:24,fontSize:14,color:"var(--text-muted)"}}><Link href="/" style={{color:"var(--text-muted)",textDecoration:"none"}}>DApps</Link><span style={{margin:"0 8px"}}>›</span>Categories</div>
    <h1 style={{fontSize:28,fontWeight:800,marginBottom:10}}>Cardano DApp Categories</h1><p style={{fontSize:15,color:"var(--text-secondary)",maxWidth:600,lineHeight:1.6,marginBottom:32}}>Browse DApps by category. Only categories with recorded contract activity are shown.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:16}}>{categories.map(({slug,count})=>{const color=CATEGORY_COLORS[categorySlugMap[slug][0]]||"#6b7280"; return <Link key={slug} href={`/category/${slug}`} style={{textDecoration:"none"}}><div className="card category-card" style={{padding:"22px 24px",borderLeft:`3px solid ${color}`}}><div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}><span style={{fontSize:24}}>{ICONS[slug]}</span><span style={{fontWeight:700,fontSize:16,color:"var(--text-primary)"}}>{categoryDisplayName[slug]}</span></div><p style={{fontSize:13,color:"var(--text-secondary)",marginBottom:16,lineHeight:1.5}}>{DESCRIPTIONS[slug]}</p><div style={{fontSize:11,color:"var(--text-muted)",fontWeight:600,textTransform:"uppercase",marginBottom:2}}>DApps with data</div><div style={{fontSize:18,fontWeight:700,color}}>{count}</div></div></Link>;})}</div>
  </main>;
}
