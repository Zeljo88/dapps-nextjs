import { NextResponse } from "next/server";
import { fetchLiveAnalytics } from "@/lib/analytics";
import { fetchCurrentTvl } from "@/lib/tvl";
import type { LiveDirectorySnapshot } from "@/lib/live-directory";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" };

export async function GET() {
  try {
    const { status, dapps } = await fetchLiveAnalytics();
    const currentTvl = await fetchCurrentTvl(dapps.map(dapp => dapp.slug));
    const result: LiveDirectorySnapshot = { generatedAt: Date.now() / 1000, status,
      dapps: dapps.map(dapp => ({ slug: dapp.slug,
        observedEpoch: dapp.fresh ? dapp.observedEpoch : null,
        observedTxEpoch: dapp.fresh ? dapp.observedTxEpoch : null,
        epochRecordedSince: dapp.fresh ? dapp.epochRecordedSince : null })), currentTvl };
    return NextResponse.json(result, { headers });
  } catch { return NextResponse.json({ error: "Live observations unavailable" }, { status: 503, headers }); }
}
