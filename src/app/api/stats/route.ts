import { NextResponse } from "next/server";
import { fetchAnalytics } from "@/lib/analytics";
export async function GET() { try { const data=await fetchAnalytics(); return NextResponse.json({adaPrice:null,totalTvl:null,totalVolume30d:null,totalVolume24h:null,totalActiveUsers24h:null,totalTxCount:null,totalDapps:data.dapps.length,currentEpoch:data.status.checkpoint?.epoch ?? null,coverage:"partial",status:data.status}, {headers:{"Cache-Control":"no-store"}}); } catch { return NextResponse.json({error:"Analytics feed unavailable"},{status:503}); } }
