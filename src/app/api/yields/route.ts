import { NextResponse } from "next/server";

import { fetchYields } from "@/lib/backend";

export async function GET() {
  try {
    return NextResponse.json(await fetchYields());
  } catch {
    return NextResponse.json([], { status: 502 });
  }
}
