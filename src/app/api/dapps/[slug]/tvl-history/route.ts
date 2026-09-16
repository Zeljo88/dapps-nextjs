import { NextResponse } from "next/server";

import { BackendResponseError, fetchTvlHistory } from "@/lib/backend";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    return NextResponse.json(await fetchTvlHistory(slug));
  } catch (error) {
    const status = error instanceof BackendResponseError ? 502 : 504;
    return NextResponse.json({ points: [], totalPoints: 0 }, { status });
  }
}
