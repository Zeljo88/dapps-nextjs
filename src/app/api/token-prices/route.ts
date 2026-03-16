import { NextRequest, NextResponse } from "next/server";

// Fetch token prices from DeFiLlama coins API
// Accepts: ?units=policyId1assetName1,policyId2assetName2,...
export async function GET(req: NextRequest) {
  const units = req.nextUrl.searchParams.get("units") || "";
  if (!units) return NextResponse.json({});

  const unitList = units.split(",").filter(Boolean).slice(0, 30);

  // DeFiLlama format: cardano:policyIdAssetName (56 char policy + hex assetname)
  const llamaKeys = unitList.map(u => `cardano:${u}`).join(",");

  try {
    const res = await fetch(
      `https://coins.llama.fi/prices/current/${llamaKeys}`,
      { next: { revalidate: 300 } }
    );
    const data = await res.json();

    // Transform: { "cardano:abc123": { price, symbol, decimals } } → { "abc123": { priceUsd, symbol, decimals } }
    const result: Record<string, { priceUsd: number; symbol: string; decimals: number }> = {};
    for (const [key, val] of Object.entries(data.coins || {})) {
      const unit = key.replace("cardano:", "");
      const v = val as any;
      result[unit] = {
        priceUsd: v.price || 0,
        symbol: v.symbol || "",
        decimals: v.decimals || 0,
      };
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({});
  }
}
