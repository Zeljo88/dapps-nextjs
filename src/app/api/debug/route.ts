import { NextResponse } from "next/server";
const API = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://20.79.10.28";
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "KtMZigr7";
  try {
    const r = await fetch(`${API}/dapps/find-dapp/${id}`, { cache: "no-store" });
    const data = await r.json();
    return NextResponse.json({ status: r.status, ok: r.ok, apiUrl: API, name: data?.name, id: data?.id });
  } catch(e: any) {
    return NextResponse.json({ error: e.message, apiUrl: API });
  }
}
