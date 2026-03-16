import { NextResponse } from "next/server";

const BACKEND = process.env.API_URL || "http://20.79.10.28";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/yields`, { next: { revalidate: 3600 } });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
