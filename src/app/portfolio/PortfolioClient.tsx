"use client";
import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet";
import WalletModal from "@/components/WalletModal";
import { fmt } from "@/lib/api";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface TokenBalance {
  policyId: string;
  assetName: string;
  ticker: string;
  amount: number;
  decimals: number;
  priceUsd: number;
}

interface StakingInfo {
  poolId: string;
  poolTicker: string;
  poolName: string;
  delegatedAda: number;
  availableRewards: number;
  epoch: number;
  ros: number; // return on stake %
  isAdria: boolean;
}

interface YieldOpportunity {
  project: string;
  symbol: string;
  apy: number;
  tvlUsd: number;
  stablecoin: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Use relative path so it works on both HTTP and HTTPS (avoids mixed content)
const API = "/api";
const KOIOS = "https://api.koios.rest/api/v1";
const ADRIA_POOL_ID = "pool1we9umarzn0l6jp8mcm98y28lxuuzcurzpjldnjwtgdhgw068mnr";

function fmtAda(lovelace: number) {
  return (lovelace / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtToken(amount: number, decimals: number) {
  const val = amount / Math.pow(10, decimals);
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
  return val.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// Known token metadata (expand over time)
const TOKEN_META: Record<string, { ticker: string; decimals: number }> = {
  "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c6": { ticker: "MIN", decimals: 6 },
  "f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b69880": { ticker: "INDY", decimals: 6 },
  "533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0": { ticker: "IUSD", decimals: 6 },
  "c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad": { ticker: "SHEN", decimals: 6 },
  "8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61": { ticker: "WMT", decimals: 6 },
  "e16c2dc8ae937e8d3790c7fd7168d7b994621ba14ca11415f39fed72": { ticker: "ADA", decimals: 6 },
  "a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481ef0": { ticker: "DING", decimals: 0 },
  "1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1e": { ticker: "USDM", decimals: 6 },
  "25c5de5f5b286073c593edfd77b48abc7a48e5a4f3d4cd9d428ff935": { ticker: "DJED", decimals: 6 },
};

// ── Fetch staking info via Koios ─────────────────────────────────────────────

async function fetchStakingInfo(rewardAddress: string): Promise<StakingInfo | null> {
  if (!rewardAddress) return null;
  try {
    const res = await fetch(`/api/staking?addr=${encodeURIComponent(rewardAddress)}`);
    if (!res.ok) return null;
    const d = await res.json();
    if (d.error || !d.poolId) return null;

    return {
      poolId: d.poolId,
      poolTicker: d.poolTicker || d.poolId.slice(0, 8),
      poolName: d.poolName || d.poolTicker || "Unknown Pool",
      delegatedAda: d.delegatedLovelace || 0,
      availableRewards: d.availableRewards || 0,
      epoch: 0,
      ros: d.ros || 0,
      isAdria: d.poolId === ADRIA_POOL_ID,
    };
  } catch {
    return null;
  }
}

// ── Fetch top yield opportunities ────────────────────────────────────────────

async function fetchTopYields(): Promise<YieldOpportunity[]> {
  try {
    const res = await fetch(`${API}/yields`);
    if (!res.ok) return [];
    const yields: any[] = await res.json();
    return yields
      .filter(y => y.apy > 0 && y.tvlUsd > 100_000)
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 6)
      .map(y => ({
        project: y.project,
        symbol: y.symbol,
        apy: y.apy,
        tvlUsd: y.tvlUsd,
        stablecoin: y.stablecoin,
      }));
  } catch {
    return [];
  }
}

// ── Parse native tokens from CIP-30 balance ──────────────────────────────────

async function parseTokens(walletName: string): Promise<TokenBalance[]> {
  try {
    const { BrowserWallet } = await import("@meshsdk/core");
    const meshWallet = await BrowserWallet.enable(walletName);
    const assets = await meshWallet.getAssets();
    if (!assets?.length) return [];

    return assets.slice(0, 20).map((a: any) => {
      const policyId = a.unit?.slice(0, 56) || "";
      const meta = TOKEN_META[policyId] || null;
      // Decode hex asset name to readable string
      let ticker = a.assetName || "";
      try {
        if (ticker && /^[0-9a-fA-F]+$/.test(ticker)) {
          const decoded = Buffer.from(ticker, "hex").toString("utf8").replace(/[^\x20-\x7E]/g, "");
          if (decoded.length > 0) ticker = decoded;
        }
      } catch {}
      ticker = meta?.ticker || ticker.slice(0, 12) || "TOKEN";
      return {
        policyId,
        assetName: a.assetName || "",
        ticker,
        amount: parseInt(a.quantity || "0"),
        decimals: meta?.decimals ?? 0,
        priceUsd: 0,
      };
    });
  } catch {
    return [];
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PortfolioClient() {
  const { wallet } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [staking, setStaking] = useState<StakingInfo | null>(null);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [yields, setYields] = useState<YieldOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [adaPrice, setAdaPrice] = useState(0);
  const [tokenPrices, setTokenPrices] = useState<Record<string, { priceUsd: number; symbol: string; decimals: number }>>({});
  const [activeTab, setActiveTab] = useState<"tokens" | "nfts">("tokens");
  const [hideZero, setHideZero] = useState(true);

  useEffect(() => {
    fetch(`/api/stats`).then(r => r.json()).then(d => setAdaPrice(d.adaPrice || 0)).catch(() => {});
    fetchTopYields().then(setYields);
  }, []);

  useEffect(() => {
    if (!wallet) { setStaking(null); setTokens([]); return; }
    setLoading(true);
    console.log("[Portfolio] rewardAddress:", wallet.rewardAddress);
    Promise.all([
      fetchStakingInfo(wallet.rewardAddress),
      parseTokens(wallet.name),
    ]).then(([s, t]) => {
      console.log("[Portfolio] staking result:", s);
      setStaking(s);
      setTokens(t);
      setLoading(false);
      if (t.length > 0) {
        const units = t.map((tok: TokenBalance) => `${tok.policyId}${tok.assetName}`).join(",");
        fetch(`/api/token-prices?units=${encodeURIComponent(units)}`)
          .then(r => r.json()).then(setTokenPrices).catch(() => {});
      }
    });
  }, [wallet]);

  const adaBalance = wallet ? wallet.balanceLovelace / 1_000_000 : 0;
  const adaUsd = adaBalance * adaPrice;
  const rewardsAda = staking ? staking.availableRewards / 1_000_000 : 0;

  // Split tokens into fungible and NFTs
  // NFT heuristic: quantity = 1 AND no known price AND asset name looks like a hash (long hex)
  const fungible = tokens.filter(t => {
    const unit = `${t.policyId}${t.assetName}`;
    const hasPrice = !!tokenPrices[unit];
    const isNft = t.amount === 1 && !hasPrice && t.assetName.length > 16;
    return !isNft;
  });
  const nfts = tokens.filter(t => {
    const unit = `${t.policyId}${t.assetName}`;
    const hasPrice = !!tokenPrices[unit];
    return t.amount === 1 && !hasPrice && t.assetName.length > 16;
  });
  const rewardsUsd = rewardsAda * adaPrice;

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
          💼 My Portfolio
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
          Track your Cardano DeFi positions, staking rewards and yield opportunities.
        </p>
      </div>

      {/* Not connected */}
      {!wallet && (
        <div className="card" style={{ padding: 48, textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔗</div>
          <h2 style={{ color: "var(--text-primary)", fontSize: 22, marginBottom: 8 }}>
            Connect your wallet to get started
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24, maxWidth: 420, margin: "0 auto 24px" }}>
            Connect any Cardano wallet to see your ADA balance, tokens, staking status and personalised yield opportunities.
          </p>
          <button onClick={() => setShowModal(true)} style={{
            padding: "12px 28px", borderRadius: 10, fontSize: 15, fontWeight: 700,
            background: "linear-gradient(135deg, #0066ff, #00c6a2)",
            border: "none", color: "white", cursor: "pointer",
          }}>
            🔗 Connect Wallet
          </button>
          {showModal && <WalletModal onClose={() => setShowModal(false)} />}
        </div>
      )}

      {wallet && (
        <>
          {/* Summary bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
            <SummaryCard
              label="ADA Balance"
              value={`${fmtAda(wallet.balanceLovelace)} ₳`}
              sub={adaPrice > 0 ? `≈ $${(adaUsd).toFixed(2)}` : ""}
              color="#8b5cf6"
              icon="💜"
            />
            <SummaryCard
              label="Staking Rewards"
              value={staking ? `${fmtAda(staking.availableRewards)} ₳` : loading ? "..." : "—"}
              sub={rewardsUsd > 0 ? `≈ $${rewardsUsd.toFixed(2)}` : ""}
              color="#10b981"
              icon="🎁"
            />
            <SummaryCard
              label="Staking Pool"
              value={staking?.poolTicker || (loading ? "..." : "Not staking")}
              sub={staking?.ros ? `${staking.ros.toFixed(2)}% ROS` : ""}
              color={staking?.isAdria ? "#10b981" : "#3b82f6"}
              icon="🏊"
            />
            <SummaryCard
              label="Tokens"
              value={tokens.length > 0 ? `${fungible.length} tokens · ${nfts.length} NFTs` : loading ? "..." : "None"}
              sub=""
              color="#f59e0b"
              icon="🪙"
            />
          </div>

          {/* Staking + Token Balances */}
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <h3 style={{ ...sectionTitle, marginBottom: 0 }}>🏊 Staking Status</h3>
              {!loading && !staking && (
                <Link href="/" style={ctaBtn}>Stake with ADRIA →</Link>
              )}
              {staking && !staking.isAdria && (
                <Link href="/" style={ctaBtn}>Switch to ADRIA →</Link>
              )}
              {staking?.isAdria && (
                <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 999,
                  background: "#10b98120", color: "#10b981", border: "1px solid #10b98140", fontWeight: 600 }}>
                  ⭐ Staking with ADRIA
                </span>
              )}
            </div>

            {loading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading staking info...</p>}
            {!loading && !staking && (
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Not currently staking. Stake your ADA to earn rewards!</p>
            )}
            {staking && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 4 }}>
                <StatPill label="Pool" value={`[${staking.poolTicker}] ${staking.poolName}`} />
                <StatPill label="Delegated" value={`${fmtAda(staking.delegatedAda)} ₳`} />
                <StatPill label="Available Rewards" value={`${fmtAda(staking.availableRewards)} ₳`} color="#10b981" />
                <StatPill label="Pool ROS" value={staking.ros > 0 ? `${staking.ros.toFixed(2)}%` : "—"} />
              </div>
            )}
          </div>

          {/* Tokens + NFTs tabbed card */}
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>

            {/* Tab bar + toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
                {(["tokens", "nfts"] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    padding: "8px 18px", background: "none", border: "none", cursor: "pointer",
                    fontSize: 14, fontWeight: 600,
                    color: activeTab === tab ? "var(--accent)" : "var(--text-muted)",
                    borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                    marginBottom: -1, transition: "all 0.15s",
                  }}>
                    {tab === "tokens" ? `🪙 Tokens (${fungible.length})` : `🖼️ NFTs (${nfts.length})`}
                  </button>
                ))}
              </div>

              {/* Hide zero toggle */}
              {activeTab === "tokens" && (
                <button onClick={() => setHideZero(v => !v)} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13,
                  background: hideZero ? "rgba(139,92,246,0.15)" : "var(--bg-secondary)",
                  border: `1px solid ${hideZero ? "rgba(139,92,246,0.4)" : "var(--border)"}`,
                  color: hideZero ? "#a78bfa" : "var(--text-muted)", fontWeight: 500,
                  transition: "all 0.15s",
                }}>
                  <span style={{ fontSize: 11 }}>{hideZero ? "●" : "○"}</span>
                  Hide zero values
                </button>
              )}
            </div>

            {loading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading assets...</p>}

            {/* Tokens tab */}
            {!loading && activeTab === "tokens" && (
              <>
                {fungible.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No fungible tokens found.</p>}
                {fungible.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12,
                      padding: "8px 16px", borderBottom: "1px solid var(--border)",
                      fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
                      textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <span>Token</span>
                      <span style={{ textAlign: "right" }}>Balance</span>
                      <span style={{ textAlign: "right", minWidth: 90 }}>Value</span>
                    </div>
                    {fungible.map((t, i) => {
                      const unit = `${t.policyId}${t.assetName}`;
                      const price = tokenPrices[unit];
                      const amount = t.amount / Math.pow(10, price?.decimals ?? t.decimals);
                      const valueUsd = price ? amount * price.priceUsd : null;
                      const valueAda = (valueUsd && adaPrice > 0) ? valueUsd / adaPrice : null;
                      if (hideZero && valueAda === null) return null;
                      const displayTicker = price?.symbol || t.ticker;
                      return (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12,
                          alignItems: "center", padding: "12px 16px",
                          borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                              background: "linear-gradient(135deg, #8b5cf620, #3b82f620)",
                              border: "1px solid var(--border)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 800, color: "#8b5cf6" }}>
                              {displayTicker.slice(0, 4).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>{displayTicker}</div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.policyId.slice(0, 10)}...</div>
                            </div>
                          </div>
                          <div style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>
                            {fmtToken(t.amount, price?.decimals ?? t.decimals)}
                          </div>
                          <div style={{ textAlign: "right", minWidth: 90 }}>
                            {valueAda !== null ? (
                              <div>
                                <div style={{ fontWeight: 700, color: "#8b5cf6", fontSize: 14 }}>
                                  {valueAda >= 1000 ? `${(valueAda/1000).toFixed(1)}K ₳` : `${valueAda.toFixed(1)} ₳`}
                                </div>
                                {valueUsd !== null && (
                                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                    ≈${valueUsd < 0.01 ? valueUsd.toFixed(4) : valueUsd.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            ) : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* NFTs tab */}
            {!loading && activeTab === "nfts" && (
              <>
                {nfts.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No NFTs found in this wallet.</p>}
                {nfts.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                    {nfts.map((t, i) => (
                      <div key={i} style={{ borderRadius: 12, overflow: "hidden",
                        border: "1px solid var(--border)", background: "var(--bg-secondary)",
                        transition: "transform 0.15s, box-shadow 0.15s", cursor: "default" }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
                      >
                        {/* NFT placeholder image */}
                        <div style={{ height: 120, background: `linear-gradient(135deg, hsl(${(i*47)%360},60%,25%), hsl(${(i*47+60)%360},60%,20%))`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 32 }}>
                          🖼️
                        </div>
                        <div style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.ticker}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            {t.policyId.slice(0, 10)}...
                          </div>
                          <div style={{ fontSize: 11, color: "#10b981", marginTop: 4, fontWeight: 600 }}>
                            qty: {t.amount}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* DeFi positions — coming soon */}
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <h3 style={sectionTitle}>📈 DeFi Positions</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {["Minswap LP positions", "WingRiders LP", "Liqwid lending", "Open DEX orders"].map(label => (
                <div key={label} style={{ padding: "16px 20px", borderRadius: 10,
                  background: "var(--bg-secondary)", border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%",
                    background: "#f59e0b", boxShadow: "0 0 6px #f59e0b", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      ⏳ Syncing on-chain data...
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 16 }}>
              🔄 On-chain position tracking requires our chain indexer to finish syncing (~2 days). Check back soon!
            </p>
          </div>
        </>
      )}

      {/* Yield opportunities — always visible */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ ...sectionTitle, marginBottom: 0 }}>💡 Top Yield Opportunities</h3>
          <Link href="/yields" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>
            View all →
          </Link>
        </div>
        {yields.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading yields...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {yields.map((y, i) => (
              <div key={i} style={{ padding: "16px 20px", borderRadius: 10,
                background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 15 }}>{y.symbol}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{y.project}</div>
                  </div>
                  <span style={{
                    padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: y.stablecoin ? "#06b6d420" : "#10b98120",
                    color: y.stablecoin ? "#06b6d4" : "#10b981",
                    border: `1px solid ${y.stablecoin ? "#06b6d440" : "#10b98140"}`,
                  }}>{y.stablecoin ? "Stable" : "Variable"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800,
                    color: y.apy > 10 ? "#10b981" : y.apy > 5 ? "#f59e0b" : "var(--text-primary)" }}>
                    {y.apy.toFixed(2)}%
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>TVL {fmt(y.tvlUsd)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub: string; color: string; icon: string;
}) {
  return (
    <div className="card" style={{ padding: "20px 24px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: "12px 16px", borderRadius: 10,
      background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, color: "var(--text-secondary)",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16,
};

const ctaBtn: React.CSSProperties = {
  display: "inline-block", padding: "8px 16px", borderRadius: 8,
  background: "linear-gradient(135deg, #0066ff, #00c6a2)",
  color: "white", fontSize: 13, fontWeight: 700, textDecoration: "none",
};
