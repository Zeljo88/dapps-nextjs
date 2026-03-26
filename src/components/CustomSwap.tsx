"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@/lib/wallet";
import WalletModal from "./WalletModal";
import {
  searchTokens,
  estimateSwap,
  buildSwapTx,
  submitSwapTx,
  getWalletBalance,
  ADA_TOKEN,
  type Token,
  type EstimateResponse,
  type EstimateRequest,
  type WalletBalance,
} from "@/lib/minswap";

// ── Popular tokens for quick select ─────────────────────────────────────

// Tickers to fetch from API on mount (so we get real logos + metadata)
const POPULAR_TICKERS = ["MIN", "SNEK", "iBTC", "DJED", "LQ", "SUNDAE", "INDY", "LENFI", "IAG", "WRT"];

// ── Debounce hook ───────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

// ── Token Selector ──────────────────────────────────────────────────────

function TokenSelector({
  selected,
  onSelect,
  label,
  exclude,
}: {
  selected: Token;
  onSelect: (t: Token) => void;
  label: string;
  exclude?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [popularTokens, setPopularTokens] = useState<Token[]>([ADA_TOKEN]);
  const debouncedQuery = useDebounce(query, 300);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch popular tokens with real logos on first open
  useEffect(() => {
    if (!open || popularTokens.length > 1) return;
    (async () => {
      try {
        const allResults = await Promise.all(
          POPULAR_TICKERS.map((t) => searchTokens(t, true).catch(() => []))
        );
        const tokens: Token[] = [ADA_TOKEN];
        for (let i = 0; i < POPULAR_TICKERS.length; i++) {
          const match = allResults[i].find(
            (r) => r.ticker?.toUpperCase() === POPULAR_TICKERS[i].toUpperCase()
          );
          if (match) tokens.push(match);
        }
        setPopularTokens(tokens);
      } catch { /* keep ADA only fallback */ }
    })();
  }, [open, popularTokens.length]);

  useEffect(() => {
    if (!open) return;
    if (!debouncedQuery) {
      setResults(popularTokens.filter((t) => t.token_id !== exclude));
      return;
    }
    setLoading(true);
    searchTokens(debouncedQuery, true)
      .then((tokens) => {
        setResults(tokens.filter((t) => t.token_id !== exclude).slice(0, 20));
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery, open, exclude, popularTokens]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => { setOpen(!open); setQuery(""); }}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px", borderRadius: 12,
          background: "var(--bg-secondary)", border: "1px solid var(--border)",
          color: "var(--text-primary)", cursor: "pointer",
          fontSize: 15, fontWeight: 600, minWidth: 120,
        }}
      >
        {selected.logo ? (
          <img src={selected.logo} alt="" width={22} height={22} style={{ borderRadius: "50%" }} />
        ) : (
          <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
            {(selected.ticker || "?")[0]}
          </span>
        )}
        {selected.ticker || "Select"}
        <span style={{ fontSize: 10, opacity: 0.5, marginLeft: "auto" }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 100, marginTop: 6,
          width: 260, maxHeight: 300, overflowY: "auto",
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
        }}>
          <div style={{ padding: 10 }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tokens..."
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 10,
                border: "1px solid var(--border)", background: "var(--bg-secondary)",
                color: "var(--text-primary)", fontSize: 14, outline: "none",
              }}
            />
          </div>
          {loading && (
            <div style={{ padding: "8px 16px", color: "var(--text-muted)", fontSize: 13 }}>
              Searching...
            </div>
          )}
          {results.map((token) => (
            <button
              key={token.token_id}
              onClick={() => { onSelect(token); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "10px 14px", border: "none", cursor: "pointer",
                background: "transparent", color: "var(--text-primary)", fontSize: 14,
                textAlign: "left",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-secondary)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {token.logo ? (
                <img src={token.logo} alt="" width={24} height={24} style={{ borderRadius: "50%" }} />
              ) : (
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {(token.ticker || "?")[0]}
                </span>
              )}
              <div>
                <div style={{ fontWeight: 600 }}>{token.ticker || token.token_id.slice(0, 8)}</div>
                {token.project_name && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{token.project_name}</div>
                )}
              </div>
              {token.is_verified && (
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#10b981" }}>✓</span>
              )}
            </button>
          ))}
          {!loading && results.length === 0 && (
            <div style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 13 }}>
              No tokens found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Swap Component ─────────────────────────────────────────────────

export default function CustomSwap() {
  const { wallet } = useWallet();
  const walletApi = wallet?.api; // CIP-30 API object
  const [showWalletModal, setShowWalletModal] = useState(false);

  const [tokenIn, setTokenIn] = useState<Token>(ADA_TOKEN);
  const [tokenOut, setTokenOut] = useState<Token>({
    token_id: "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e",
    ticker: "MIN", logo: null, is_verified: true, price_by_ada: null,
    project_name: "Minswap", decimals: 6,
  });
  const [amountIn, setAmountIn] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [showSlippage, setShowSlippage] = useState(false);

  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState("");

  const [swapping, setSwapping] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [swapError, setSwapError] = useState("");

  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);

  const debouncedAmount = useDebounce(amountIn, 500);

  // Fetch logo for default tokenOut (MIN) on mount
  useEffect(() => {
    if (tokenOut.logo) return;
    searchTokens(tokenOut.ticker || "MIN", true)
      .then((results) => {
        const match = results.find((r) => r.ticker === (tokenOut.ticker || "MIN"));
        if (match?.logo) setTokenOut((prev) => ({ ...prev, logo: match.logo }));
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch wallet balance when connected
  useEffect(() => {
    if (!walletApi) { setWalletBalance(null); return; }
    (async () => {
      try {
        const addrs = await walletApi.getUsedAddresses();
        if (addrs.length > 0) {
          const bal = await getWalletBalance(addrs[0], true);
          setWalletBalance(bal);
        }
      } catch { /* ignore */ }
    })();
  }, [walletApi]);

  // Auto-estimate when amount/tokens change
  useEffect(() => {
    if (!debouncedAmount || parseFloat(debouncedAmount) <= 0) {
      setEstimate(null);
      setEstimateError("");
      return;
    }
    const decimals = tokenIn.decimals ?? 6;
    const smallestUnit = Math.floor(parseFloat(debouncedAmount) * Math.pow(10, decimals));
    if (smallestUnit <= 0) return;

    setEstimating(true);
    setEstimateError("");
    estimateSwap({
      amount: String(smallestUnit),
      token_in: tokenIn.token_id === "lovelace" ? "lovelace" : tokenIn.token_id,
      token_out: tokenOut.token_id === "lovelace" ? "lovelace" : tokenOut.token_id,
      slippage,
      allow_multi_hops: true,
      partner: "dappsoncardano",
    })
      .then(setEstimate)
      .catch((err) => {
        setEstimate(null);
        setEstimateError(err.message || "Failed to get estimate");
      })
      .finally(() => setEstimating(false));
  }, [debouncedAmount, tokenIn.token_id, tokenOut.token_id, slippage, tokenIn.decimals]);

  // Flip tokens
  const handleFlip = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn("");
    setEstimate(null);
  };

  // Execute swap
  const handleSwap = async () => {
    if (!walletApi || !estimate) return;
    setSwapping(true);
    setSwapError("");
    setTxHash("");

    try {
      const addrs = await walletApi.getUsedAddresses();
      const sender = addrs[0];
      const decimals = tokenIn.decimals ?? 6;
      const smallestUnit = Math.floor(parseFloat(amountIn) * Math.pow(10, decimals));

      // Build unsigned tx
      const { cbor } = await buildSwapTx({
        sender,
        min_amount_out: estimate.min_amount_out,
        estimate: {
          amount: String(smallestUnit),
          token_in: tokenIn.token_id === "lovelace" ? "lovelace" : tokenIn.token_id,
          token_out: tokenOut.token_id === "lovelace" ? "lovelace" : tokenOut.token_id,
          slippage,
          allow_multi_hops: true,
          partner: "dappsoncardano",
        },
      });

      // Sign with wallet
      const witnessSet = await walletApi.signTx(cbor, true);

      // Submit
      const { tx_id } = await submitSwapTx({ cbor, witness_set: witnessSet });
      setTxHash(tx_id);
      setAmountIn("");
      setEstimate(null);
    } catch (err: any) {
      setSwapError(err.message || "Swap failed");
    } finally {
      setSwapping(false);
    }
  };

  // Get user's balance for tokenIn
  const getBalance = (): string => {
    if (!walletBalance) return "";
    if (tokenIn.token_id === "lovelace") return walletBalance.ada;
    const found = walletBalance.balance.find((b) => b.asset.token_id === tokenIn.token_id);
    return found?.amount || "0";
  };

  const balance = getBalance();
  const outDecimals = tokenOut.decimals ?? 6;
  const estimatedOut = estimate
    ? (parseFloat(estimate.amount_out) / Math.pow(10, outDecimals)).toFixed(outDecimals > 2 ? 4 : 2)
    : "";

  return (
    <>
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: "16px", width: "100%",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
            Swap
          </span>
          <button
            onClick={() => setShowSlippage(!showSlippage)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", fontSize: 18, padding: 4,
            }}
            title="Settings"
          >
            ⚙️
          </button>
        </div>

        {/* Slippage settings */}
        {showSlippage && (
          <div style={{
            display: "flex", gap: 8, marginBottom: 14, alignItems: "center",
          }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Slippage:</span>
            {[0.5, 1, 2, 3].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                style={{
                  padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${slippage === s ? "var(--accent)" : "var(--border)"}`,
                  background: slippage === s ? "var(--accent)" : "transparent",
                  color: slippage === s ? "#fff" : "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                {s}%
              </button>
            ))}
          </div>
        )}

        {/* Token In */}
        <div style={{
          background: "var(--bg-secondary)", borderRadius: 14,
          padding: "14px 16px", marginBottom: 4,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
              You pay
            </span>
            {balance && (
              <button
                onClick={() => setAmountIn(balance)}
                style={{
                  fontSize: 11, color: "var(--accent)", background: "none",
                  border: "none", cursor: "pointer", fontWeight: 600,
                }}
              >
                Balance: {parseFloat(balance).toFixed(2)} MAX
              </button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="number"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder="0.00"
              style={{
                flex: 1, background: "transparent", border: "none",
                color: "var(--text-primary)", fontSize: 24, fontWeight: 700,
                outline: "none", minWidth: 0,
              }}
            />
            <TokenSelector
              selected={tokenIn}
              onSelect={setTokenIn}
              label="From"
              exclude={tokenOut.token_id}
            />
          </div>
        </div>

        {/* Flip button */}
        <div style={{ display: "flex", justifyContent: "center", margin: "-10px 0", position: "relative", zIndex: 5 }}>
          <button
            onClick={handleFlip}
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: "var(--bg-card)", border: "2px solid var(--border)",
              color: "var(--text-primary)", fontSize: 16,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ↕
          </button>
        </div>

        {/* Token Out */}
        <div style={{
          background: "var(--bg-secondary)", borderRadius: 14,
          padding: "14px 16px", marginBottom: 14, marginTop: 4,
        }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
              You receive
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              flex: 1, fontSize: 24, fontWeight: 700,
              color: estimatedOut ? "var(--text-primary)" : "var(--text-muted)",
              minHeight: 36, display: "flex", alignItems: "center",
            }}>
              {estimating ? (
                <span style={{ fontSize: 14, color: "var(--text-muted)" }}>Estimating...</span>
              ) : estimatedOut || "0.00"}
            </div>
            <TokenSelector
              selected={tokenOut}
              onSelect={setTokenOut}
              label="To"
              exclude={tokenIn.token_id}
            />
          </div>
        </div>

        {/* Route info */}
        {estimate && (
          <div style={{
            background: "var(--bg-secondary)", borderRadius: 12,
            padding: "10px 14px", marginBottom: 14, fontSize: 12,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "var(--text-muted)" }}>Price Impact</span>
              <span style={{
                fontWeight: 600,
                color: estimate.avg_price_impact > 2 ? "#ef4444" :
                       estimate.avg_price_impact > 0.5 ? "#f59e0b" : "#10b981"
              }}>
                {estimate.avg_price_impact.toFixed(2)}%
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "var(--text-muted)" }}>Route</span>
              <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                {estimate.paths.flat().map(p => p.protocol).filter((v, i, a) => a.indexOf(v) === i).join(" → ")}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "var(--text-muted)" }}>DEX Fee</span>
              <span style={{ color: "var(--text-secondary)" }}>
                {(parseFloat(estimate.total_dex_fee) / 1_000_000).toFixed(2)} ADA
              </span>
            </div>
            {estimate.avg_price_impact > 2 && (
              <div style={{
                marginTop: 6, padding: "6px 10px", borderRadius: 8,
                background: "#ef444420", border: "1px solid #ef444440",
                color: "#ef4444", fontSize: 11, fontWeight: 600,
              }}>
                ⚠️ High price impact! Consider reducing the amount.
              </div>
            )}
          </div>
        )}

        {/* Estimate error */}
        {estimateError && (
          <div style={{
            padding: "8px 12px", borderRadius: 10, marginBottom: 14,
            background: "#ef444420", border: "1px solid #ef444440",
            color: "#ef4444", fontSize: 12,
          }}>
            {estimateError}
          </div>
        )}

        {/* Swap / Connect button */}
        {!wallet ? (
          <button
            onClick={() => setShowWalletModal(true)}
            style={{
              width: "100%", padding: "14px", borderRadius: 14,
              background: "var(--accent)", border: "none",
              color: "#fff", fontSize: 16, fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Connect Wallet
          </button>
        ) : (
          <button
            onClick={handleSwap}
            disabled={!estimate || swapping || estimating}
            style={{
              width: "100%", padding: "14px", borderRadius: 14,
              background: !estimate || swapping ? "var(--bg-secondary)" : "var(--accent)",
              border: "1px solid var(--border)",
              color: !estimate || swapping ? "var(--text-muted)" : "#fff",
              fontSize: 16, fontWeight: 700,
              cursor: !estimate || swapping ? "not-allowed" : "pointer",
              opacity: swapping ? 0.7 : 1,
            }}
          >
            {swapping ? "Swapping..." : !amountIn ? "Enter amount" : !estimate ? "Get Quote" : "Swap"}
          </button>
        )}

        {/* Success */}
        {txHash && (
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 12,
            background: "#10b98120", border: "1px solid #10b98140",
            fontSize: 13,
          }}>
            <div style={{ color: "#10b981", fontWeight: 600, marginBottom: 4 }}>✅ Swap submitted!</div>
            <a
              href={`https://cardanoscan.io/transaction/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", wordBreak: "break-all", fontSize: 12 }}
            >
              View on CardanoScan →
            </a>
          </div>
        )}

        {/* Swap error */}
        {swapError && (
          <div style={{
            marginTop: 12, padding: "8px 12px", borderRadius: 10,
            background: "#ef444420", border: "1px solid #ef444440",
            color: "#ef4444", fontSize: 12,
          }}>
            {swapError}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 10, textAlign: "center",
          fontSize: 10, color: "var(--text-muted)", opacity: 0.7,
        }}>
          Best rates across 14 Cardano DEXes
        </div>
      </div>

      {showWalletModal && <WalletModal onClose={() => setShowWalletModal(false)} />}
    </>
  );
}
