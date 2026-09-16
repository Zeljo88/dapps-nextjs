import { NextResponse } from "next/server";

import { fetchGlobalStats } from "@/lib/backend";

export async function GET() {
  try {
    return NextResponse.json(await fetchGlobalStats());
  } catch {
    return NextResponse.json({}, { status: 502 });
  }
}
