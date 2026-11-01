import { fetchAnalytics } from "@/lib/analytics";
import { hasRecordedActivity } from "@/lib/dapp-view";
import { CoverageNotice, FeedUnavailable } from "@/components/ContractAnalytics";
import EcosystemCharts from "@/components/EcosystemCharts";
export const dynamic = "force-dynamic";
export const metadata = { title:"Cardano Ecosystem Overview",description:"Explore the coverage of our Cardano contract activity feed.",alternates:{canonical:"https://dappsoncardano.com/ecosystem"} };
export default async function Ecosystem() {
  const data=await fetchAnalytics().catch(()=>null);
  if(!data)return <FeedUnavailable/>;
  const dapps=data.dapps.filter(hasRecordedActivity);
  const categories=new Map<string,number>();
  for(const dapp of dapps)categories.set(dapp.category,(categories.get(dapp.category)||0)+1);
  const eco={tvlLeaderboard:[],volumeLeaderboard:[],categoryBreakdown:[...categories].map(([category,count])=>({category,count}))};
  return <main style={{maxWidth:1280,margin:"0 auto",padding:"32px 24px"}}><div style={{marginBottom:24}}><h1 style={{fontSize:32,fontWeight:800,marginBottom:8}}>Cardano Ecosystem</h1><p style={{fontSize:16,color:"var(--text-secondary)"}}>{dapps.length} DApps with recorded activity · Epoch {data.status.checkpoint?.epoch??"—"}</p></div><CoverageNotice status={data.status} compact/><EcosystemCharts eco={eco}/></main>;
}
