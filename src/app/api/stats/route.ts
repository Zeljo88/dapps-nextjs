import { NextResponse } from "next/server";
import { fetchAnalytics } from "@/lib/analytics";
import { feedIsFresh } from "@/lib/feed-freshness";
export const revalidate = 60;
export async function GET() {
  try {
    const data = await fetchAnalytics();
    const fresh = feedIsFresh(data.status);
    return NextResponse.json({ adaPrice:null, totalTvl:null, totalVolume30d:null, totalVolume24h:null, totalActiveUsers24h:null,
      totalTxCount:null, totalDapps:data.dapps.length, currentEpoch:fresh ? data.status.checkpoint?.epoch ?? null : null,
      coverage:"partial", status:{...data.status,fresh}, asOf:data.status.snapshotAt ?? null },
      {headers:{"Cache-Control":"public, max-age=0, s-maxage=60, must-revalidate"}});
  } catch { return NextResponse.json({error:"Analytics feed unavailable"},{status:503,headers:{"Cache-Control":"no-store"}}); }
}
