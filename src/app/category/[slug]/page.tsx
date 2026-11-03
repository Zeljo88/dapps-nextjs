import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAnalytics, fetchHistory } from "@/lib/analytics";
import { selectEpochPeriod, directoryPeriod } from "@/lib/epoch-summary";
import { hasRecordedActivity, tableDapp } from "@/lib/dapp-view";
import { CoverageNotice, FeedUnavailable } from "@/components/ContractAnalytics";
import DAppTable from "@/components/DAppTable";
import { categoryDisplayName, categorySlugMap } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const{slug}=await params;if(!categorySlugMap[slug])notFound();return{title:`Cardano ${categoryDisplayName[slug]} DApps`,description:`Cardano ${categoryDisplayName[slug]} DApps with recorded contract activity.`,alternates:{canonical:`https://dappsoncardano.com/category/${slug}`}};}
export default async function Category({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const categories=categorySlugMap[slug];
  if(!categories)notFound();
  const [data,history]=await Promise.all([fetchAnalytics().catch(()=>null),fetchHistory().catch(()=>null)]);
  if(!data)return <FeedUnavailable />;
  const dapps=data.dapps.filter(hasRecordedActivity).filter(d=>categories.includes(d.category));
  const period=selectEpochPeriod(history,data.status.registryDigest);
  const reporting=directoryPeriod(period,data.status);
  return <main style={{maxWidth:1280,margin:"0 auto",padding:"32px 24px"}}>
    <div style={{marginBottom:24,fontSize:14,color:"var(--text-muted)"}}><Link href="/category" style={{color:"var(--text-muted)",textDecoration:"none"}}>Categories</Link><span style={{margin:"0 8px"}}>›</span>{categoryDisplayName[slug]}</div>
    <h1 style={{fontSize:28,fontWeight:800,marginBottom:10}}>Cardano {categoryDisplayName[slug]} DApps</h1><p style={{color:"var(--text-secondary)",fontSize:15,lineHeight:1.6,marginBottom:24}}>Compare DApps with recorded activity. Projects without observations are hidden.</p>
    <DAppTable dapps={dapps.map(dapp=>tableDapp(dapp,period))} period={reporting} notice={<CoverageNotice status={data.status} compact/>} hideFilters/>
  </main>;
}
