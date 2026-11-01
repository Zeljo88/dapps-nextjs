import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAnalytics } from "@/lib/analytics";
import { hasRecordedActivity, tableDapp } from "@/lib/dapp-view";
import { CoverageNotice, FeedUnavailable } from "@/components/ContractAnalytics";
import CompactStat from "@/components/CompactStat";
import DAppTable from "@/components/DAppTable";
import { categoryDisplayName, categorySlugMap } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const{slug}=await params;if(!categorySlugMap[slug])notFound();return{title:`Cardano ${categoryDisplayName[slug]} DApps`,description:`Cardano ${categoryDisplayName[slug]} DApps with recorded contract activity.`,alternates:{canonical:`https://dappsoncardano.com/category/${slug}`}};}
export default async function Category({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const categories=categorySlugMap[slug];
  if(!categories)notFound();
  const data=await fetchAnalytics().catch(()=>null);
  if(!data)return <FeedUnavailable />;
  const dapps=data.dapps.filter(hasRecordedActivity).filter(d=>categories.includes(d.category));
  return <main style={{maxWidth:1280,margin:"0 auto",padding:"32px 24px"}}>
    <div style={{marginBottom:24,fontSize:14,color:"var(--text-muted)"}}><Link href="/category" style={{color:"var(--text-muted)",textDecoration:"none"}}>Categories</Link><span style={{margin:"0 8px"}}>›</span>{categoryDisplayName[slug]}</div>
    <h1 style={{fontSize:28,fontWeight:800,marginBottom:10}}>Cardano {categoryDisplayName[slug]} DApps</h1><p style={{color:"var(--text-secondary)",fontSize:15,lineHeight:1.6,marginBottom:24}}>Compare DApps with recorded activity. Projects without observations are hidden.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:16,marginBottom:20}}><CompactStat label="DApps with data" value={dapps.length} color="#8b5cf6"/><CompactStat label="TVL" value={null} isCurrency color="#10b981"/><CompactStat label="30D Volume" value={null} isCurrency color="#06b6d4"/><CompactStat label="Tracked scripts" value={dapps.reduce((sum,d)=>sum+d.scripts.length,0)} color="#f59e0b"/></div>
    <CoverageNotice status={data.status} compact/><DAppTable dapps={dapps.map(tableDapp)} adaPrice={0} hideFilters/>
  </main>;
}
