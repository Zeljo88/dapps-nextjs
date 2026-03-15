// Test: what does Vercel see when calling our API?
import { NextResponse } from "next/server";
const API = process.env.API_URL || "http://20.79.10.28";
export async function GET() {
  try {
    const r = await fetch(`${API}/dapps/find-dapp/Minswap`, { cache: "no-store" });
    return NextResponse.json({ status: r.status, ok: r.ok, apiUrl: API });
  } catch(e: any) {
    return NextResponse.json({ error: e.message, apiUrl: API });
  }
}
