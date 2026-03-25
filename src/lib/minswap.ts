/**
 * Minswap Aggregator API client
 * Base URL: https://agg-api.minswap.org/aggregator
 * No API key required. Partner code optional (register at minswap.org/partners).
 */

const AGG_BASE = "https://agg-api.minswap.org/aggregator";

// ── Types ──────────────────────────────────────────────────────────────────

export type Token = {
  token_id: string;       // "" for ADA/lovelace, or policyId+assetNameHex
  logo: string | null;
  ticker: string | null;
  is_verified: boolean | null;
  price_by_ada: number | null;
  project_name: string | null;
  decimals: number | null;
};

export type EstimateRequest = {
  amount: string;           // in smallest unit (lovelace) or decimal if amount_in_decimal=true
  token_in: string;         // "lovelace" for ADA, or policyId+assetNameHex
  token_out: string;
  slippage: number;         // e.g. 0.5 for 0.5%
  partner?: string;         // partner code for revenue sharing
  allow_multi_hops?: boolean;
  amount_in_decimal?: boolean;
};

export type RoutePath = {
  pool_id: string;
  protocol: string;
  token_in: string;
  token_out: string;
  amount_in: string;
  amount_out: string;
  min_amount_out: string;
  lp_fee: string;
  dex_fee: string;
  deposits: string;
  price_impact: number;
};

export type EstimateResponse = {
  token_in: string;
  token_out: string;
  amount_in: string;
  amount_out: string;
  min_amount_out: string;
  total_lp_fee: string;
  total_dex_fee: string;
  deposits: string;
  avg_price_impact: number;
  paths: RoutePath[][];
  aggregator_fee: string;
  aggregator_fee_percent: number;
  amount_in_decimal?: boolean;
};

export type BuildTxRequest = {
  sender: string;           // bech32 wallet address
  min_amount_out: string;
  estimate: EstimateRequest;
  amount_in_decimal?: boolean;
};

export type BuildTxResponse = {
  cbor: string;             // unsigned tx CBOR hex
};

export type SubmitTxRequest = {
  cbor: string;
  witness_set: string;
};

export type SubmitTxResponse = {
  tx_id: string;
};

export type WalletBalance = {
  wallet: string;
  ada: string;
  minimum_lovelace: string;
  balance: Array<{ asset: Token; amount: string }>;
  amount_in_decimal: boolean;
};

// ── API calls ──────────────────────────────────────────────────────────────

export async function searchTokens(
  query: string,
  onlyVerified = true
): Promise<Token[]> {
  const res = await fetch(`${AGG_BASE}/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, only_verified: onlyVerified }),
  });
  if (!res.ok) throw new Error(`Token search failed: ${res.status}`);
  const data = await res.json();
  return data.tokens || [];
}

export async function getWalletBalance(
  address: string,
  amountInDecimal = true
): Promise<WalletBalance> {
  const params = new URLSearchParams({
    address,
    amount_in_decimal: String(amountInDecimal),
  });
  const res = await fetch(`${AGG_BASE}/wallet?${params}`);
  if (!res.ok) throw new Error(`Wallet query failed: ${res.status}`);
  return res.json();
}

export async function estimateSwap(
  req: EstimateRequest
): Promise<EstimateResponse> {
  const res = await fetch(`${AGG_BASE}/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Estimate failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function buildSwapTx(
  req: BuildTxRequest
): Promise<BuildTxResponse> {
  const res = await fetch(`${AGG_BASE}/build-tx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Build TX failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function submitSwapTx(
  req: SubmitTxRequest
): Promise<SubmitTxResponse> {
  const res = await fetch(`${AGG_BASE}/finalize-and-submit-tx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Submit TX failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** ADA token constant */
export const ADA_TOKEN: Token = {
  token_id: "lovelace",
  logo: "https://app.minswap.org/images/assets/cardano.png",
  ticker: "ADA",
  is_verified: true,
  price_by_ada: 1,
  project_name: "Cardano",
  decimals: 6,
};

/** Format lovelace or smallest-unit amount to human-readable with decimals */
export function formatTokenAmount(
  amount: string | number,
  decimals: number = 6
): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return "0";
  const val = n / Math.pow(10, decimals);
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
  if (val >= 1) return val.toFixed(2);
  if (val >= 0.01) return val.toFixed(4);
  return val.toFixed(6);
}
