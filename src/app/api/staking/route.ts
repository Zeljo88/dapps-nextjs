import { NextRequest, NextResponse } from "next/server";

const KOIOS = "https://api.koios.rest/api/v1";

export async function GET(req: NextRequest) {
  const addr = req.nextUrl.searchParams.get("addr") || "";
  if (!addr) return NextResponse.json({ error: "no addr" });

  // Try account_info directly
  const res = await fetch(`${KOIOS}/account_info`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept": "application/json" },
    body: JSON.stringify({ _stake_addresses: [addr] }),
  });
  const data = await res.json();

  // If empty, try address_info to get stake address
  let stakeAddr = addr;
  if (!data?.length) {
    const r2 = await fetch(`${KOIOS}/address_info`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "accept": "application/json" },
      body: JSON.stringify({ _addresses: [addr] }),
    });
    const d2 = await r2.json();
    stakeAddr = d2?.[0]?.stake_address || addr;

    if (stakeAddr !== addr) {
      const r3 = await fetch(`${KOIOS}/account_info`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "accept": "application/json" },
        body: JSON.stringify({ _stake_addresses: [stakeAddr] }),
      });
      const d3 = await r3.json();
      return NextResponse.json({ resolvedStakeAddr: stakeAddr, accountInfo: d3, originalAddr: addr });
    }
  }

  return NextResponse.json({ originalAddr: addr, accountInfo: data });
}
