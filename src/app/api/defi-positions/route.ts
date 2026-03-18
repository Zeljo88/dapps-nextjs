import { NextRequest, NextResponse } from "next/server";

const KOIOS = "https://api.koios.rest/api/v1";

// Known LP / lending token policy IDs
const PROTOCOLS: Record<string, { name: string; type: "lp" | "lending" }> = {
  "e4214b7cce62ac6fbba385d164df48e157eae5863521b4b67ca71d86": { name: "Minswap", type: "lp" },
  "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c": { name: "Minswap v2", type: "lp" },
  "026a18d04a0c642759bb3d83b12e3344894e5c1c7b2aeb1a2113a570": { name: "WingRiders", type: "lp" },
  "da8c30857834c6ae7203935b89278c532b3995245295456f993e1d24": { name: "Liqwid", type: "lending" },
};

// Liqwid qToken asset names → readable labels
const LIQWID_QTOKENS: Record<string, string> = {
  "7141444100000000000000000000000000000000000000000000000000000000": "qADA",
  "qADA": "qADA",
  "qDJED": "qDJED",
  "qiUSD": "qiUSD",
  "qUSDM": "qUSDM",
  "qSHEN": "qSHEN",
  "qMIN": "qMIN",
};

function decodeHex(hex: string): string {
  try {
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
      return Buffer.from(hex, "hex").toString("utf8").replace(/[^\x20-\x7E]/g, "").trim();
    }
  } catch {}
  return hex;
}

function decodePairFromAssetName(assetName: string, protocol: string): string {
  const raw = decodeHex(assetName);

  // Liqwid qTokens: asset name is ascii like "qADA"
  if (protocol === "Liqwid") {
    return LIQWID_QTOKENS[raw] || LIQWID_QTOKENS[assetName] || raw || "qToken";
  }

  // Minswap / WingRiders LP: asset name is typically "<TokenA>/<TokenB>" or a hash
  // Try to extract pair from decoded name
  if (raw && raw.includes("/")) return raw;
  if (raw && raw.length > 0 && raw.length <= 40) return raw;

  // Fall back to truncated hex
  return assetName.slice(0, 12) + "…";
}

export interface DefiPosition {
  protocol: string;
  type: "lp" | "lending";
  pair: string;
  quantity: number;
  policyId: string;
  assetName: string;
}

export async function GET(req: NextRequest) {
  const addr = req.nextUrl.searchParams.get("addr") || "";
  if (!addr) return NextResponse.json({ error: "no addr" }, { status: 400 });

  // Ensure we have a stake address
  let stakeAddr = addr;
  if (!addr.startsWith("stake")) {
    try {
      const r = await fetch(`${KOIOS}/address_info`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ _addresses: [addr] }),
      });
      const d = await r.json();
      stakeAddr = d?.[0]?.stake_address || addr;
    } catch {}
  }

  // 1. Get all addresses for this stake key
  let addresses: string[] = [];
  try {
    const r = await fetch(`${KOIOS}/account_addresses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ _stake_addresses: [stakeAddr] }),
    });
    const d = await r.json();
    addresses = (d || []).map((a: any) => a.address).filter(Boolean);
  } catch {
    return NextResponse.json({ error: "failed to fetch addresses" }, { status: 502 });
  }

  if (addresses.length === 0) {
    return NextResponse.json({ positions: [] });
  }

  // 2. Get all assets held across those addresses (batch up to 100)
  const batch = addresses.slice(0, 100);
  let rawAssets: Array<{ address: string; asset_list: Array<{ policy_id: string; asset_name: string; quantity: string }> }> = [];
  try {
    const r = await fetch(`${KOIOS}/address_assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ _addresses: batch }),
    });
    rawAssets = await r.json();
    if (!Array.isArray(rawAssets)) rawAssets = [];
  } catch {
    return NextResponse.json({ error: "failed to fetch assets" }, { status: 502 });
  }

  // 3. Flatten and filter for known DeFi protocol tokens
  const positions: DefiPosition[] = [];
  const seen = new Set<string>();

  for (const addrEntry of rawAssets) {
    for (const asset of addrEntry.asset_list || []) {
      const proto = PROTOCOLS[asset.policy_id];
      if (!proto) continue;

      const key = `${asset.policy_id}${asset.asset_name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const pair = decodePairFromAssetName(asset.asset_name, proto.name);
      positions.push({
        protocol: proto.name,
        type: proto.type,
        pair,
        quantity: parseInt(asset.quantity || "0"),
        policyId: asset.policy_id,
        assetName: asset.asset_name,
      });
    }
  }

  // Aggregate duplicate policy+assetName across addresses (sum quantities)
  const aggregated = new Map<string, DefiPosition>();
  for (const p of positions) {
    const key = `${p.policyId}${p.assetName}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.quantity += p.quantity;
    } else {
      aggregated.set(key, { ...p });
    }
  }

  return NextResponse.json({ positions: Array.from(aggregated.values()) });
}
