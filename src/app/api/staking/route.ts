import { NextRequest, NextResponse } from "next/server";

const KOIOS = "https://api.koios.rest/api/v1";

export async function GET(req: NextRequest) {
  const addr = req.nextUrl.searchParams.get("addr") || "";
  if (!addr) return NextResponse.json({ error: "no addr" });

  // Resolve to stake address if needed
  let stakeAddr = addr;
  if (!addr.startsWith("stake")) {
    try {
      const r = await fetch(`${KOIOS}/address_info`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "accept": "application/json" },
        body: JSON.stringify({ _addresses: [addr] }),
      });
      const d = await r.json();
      stakeAddr = d?.[0]?.stake_address || addr;
    } catch {}
  }

  // Get account info
  const res = await fetch(`${KOIOS}/account_info`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept": "application/json" },
    body: JSON.stringify({ _stake_addresses: [stakeAddr] }),
  });
  const acc = (await res.json())?.[0];
  if (!acc) return NextResponse.json({ error: "not found", stakeAddr });

  // Get pool metadata
  let poolTicker = acc.delegated_pool?.slice(0, 8) || "";
  let poolName = acc.delegated_pool || "";
  let ros = 0;

  if (acc.delegated_pool) {
    try {
      const pr = await fetch(`${KOIOS}/pool_info`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "accept": "application/json" },
        body: JSON.stringify({ _pool_bech32_ids: [acc.delegated_pool] }),
      });
      const pool = (await pr.json())?.[0];
      if (pool) {
        // meta_json may be null — fetch from meta_url directly
        if (pool.meta_json?.ticker) {
          poolTicker = pool.meta_json.ticker;
          poolName = pool.meta_json.name || poolTicker;
        } else if (pool.meta_url) {
          try {
            const mr = await fetch(pool.meta_url, { signal: AbortSignal.timeout(4000) });
            const meta = await mr.json();
            poolTicker = meta.ticker || poolTicker;
            poolName = meta.name || poolName;
          } catch {}
        }
        ros = parseFloat(pool.live_ros || "0") * 100 || 0;
      }
    } catch {}
  }

  return NextResponse.json({
    stakeAddr,
    poolId: acc.delegated_pool || "",
    poolTicker,
    poolName,
    delegatedLovelace: parseInt(acc.total_balance || "0"),
    availableRewards: parseInt(acc.rewards_available || "0"),
    ros,
  });
}
