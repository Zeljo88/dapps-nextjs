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
  // Koios needs bech32 stake address — skip if it looks like raw hex without stake prefix
  const addr = rewardAddress.startsWith("stake") ? rewardAddress : null;
  if (!addr) return null;
  try {
    const res = await fetch(`${KOIOS}/account_info`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "accept": "application/json" },
      body: JSON.stringify({ _stake_addresses: [addr] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const acc = data?.[0];
    if (!acc) return null;

    // Get pool info
    let poolTicker = acc.delegated_pool || "";
    let poolName = acc.delegated_pool || "Unknown Pool";
    let ros = 0;

    if (acc.delegated_pool) {
      try {
        const poolRes = await fetch(`${KOIOS}/pool_info`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "accept": "application/json" },
          body: JSON.stringify({ _pool_bech32_ids: [acc.delegated_pool] }),
        });
        if (poolRes.ok) {
          const poolData = await poolRes.json();
          const pool = poolData?.[0];
          if (pool) {
            poolTicker = pool.meta_json?.ticker || acc.delegated_pool.slice(0, 8);
            poolName = pool.meta_json?.name || poolTicker;
            ros = parseFloat(pool.live_ros || "0") * 100;
          }
        }
      } catch {}
    }

    return {
      poolId: acc.delegated_pool || "",
      poolTicker,
      poolName,
      delegatedAda: parseInt(acc.controlled_amount || "0"),
      availableRewards: parseInt(acc.rewards_available || "0"),
      epoch: acc.epoch_no || 0,
      ros,
      isAdria: acc.delegated_pool === ADRIA_POOL_ID,
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
      const meta = TOKEN_META[policyId] || { ticker: a.assetName?.slice(0, 8) || "TOKEN", decimals: 0 };
      return {
        policyId,
        assetName: a.assetName || "",
        ticker: a.assetName || meta.ticker,
        amount: parseInt(a.quantity || "0"),
        decimals: meta.decimals,
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

  useEffect(() => {
    fetch(`/api/stats`).then(r => r.json()).then(d => setAdaPrice(d.adaPrice || 0)).catch(() => {});
    fetchTopYields().then(setYields);
  }, []);

  useEffect(() => {
    if (!wallet) { setStaking(null); setTokens([]); return; }
    setLoading(true);
    Promise.all([
      fetchStakingInfo(wallet.rewardAddress),
      parseTokens(wallet.name),
    ]).then(([s, t]) => {
      setStaking(s);
      setTokens(t);
      setLoading(false);
    });
  }, [wallet]);

  const adaBalance = wallet ? wallet.balanceLovelace / 1_000_000 : 0;
  const adaUsd = adaBalance * adaPrice;
  const rewardsAda = staking ? staking.availableRewards / 1_000_000 : 0;
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
              value={tokens.length > 0 ? `${tokens.length} assets` : loading ? "..." : "None"}
              sub=""
              color="#f59e0b"
              icon="🪙"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

            {/* ADA & Staking */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={sectionTitle}>🏊 Staking Status</h3>
              {loading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading...</p>}
              {!loading && !staking && (
                <div>
                  <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 16 }}>Not currently staking.</p>
                  <Link href="/" style={ctaBtn}>Stake with ADRIA →</Link>
                </div>
              )}
              {staking && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <InfoRow label="Pool" value={
                    <span>
                      {staking.poolTicker}
                      {staking.isAdria && (
                        <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px",
                          borderRadius: 999, background: "#10b98120", color: "#10b981",
                          border: "1px solid #10b98140" }}>ADRIA ⭐</span>
                      )}
                    </span>
                  } />
                  <InfoRow label="Pool name" value={staking.poolName} />
                  <InfoRow label="Delegated" value={`${fmtAda(staking.delegatedAda)} ₳`} />
                  <InfoRow label="Available rewards" value={
                    <span style={{ color: "#10b981", fontWeight: 700 }}>
                      {fmtAda(staking.availableRewards)} ₳
                      {adaPrice > 0 && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> (≈${rewardsUsd.toFixed(2)})</span>}
                    </span>
                  } />
                  <InfoRow label="Pool ROS" value={staking.ros > 0 ? `${staking.ros.toFixed(2)}%` : "—"} />
                  {!staking.isAdria && (
                    <div style={{ marginTop: 8, padding: "12px 16px", background: "#8b5cf610",
                      borderRadius: 8, border: "1px solid #8b5cf630" }}>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                        💡 Switch to ADRIA and support a community-focused SPO
                      </p>
                      <Link href="/" style={ctaBtn}>Stake with ADRIA →</Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Native tokens */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={sectionTitle}>🪙 Token Balances</h3>
              {loading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading tokens...</p>}
              {!loading && tokens.length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No native tokens found in this wallet.</p>
              )}
              {tokens.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tokens.map((t, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between",
                      alignItems: "center", padding: "10px 0",
                      borderBottom: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: "linear-gradient(135deg, #8b5cf620, #3b82f620)",
                          border: "1px solid var(--border)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, fontWeight: 700, color: "#8b5cf6",
                        }}>
                          {t.ticker.slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>{t.ticker}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {t.policyId.slice(0, 12)}...
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)", fontFamily: "monospace" }}>
                          {fmtToken(t.amount, t.decimals)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

const sectionTitle: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, color: "var(--text-secondary)",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16,
};

const ctaBtn: React.CSSProperties = {
  display: "inline-block", padding: "8px 16px", borderRadius: 8,
  background: "linear-gradient(135deg, #0066ff, #00c6a2)",
  color: "white", fontSize: 13, fontWeight: 700, textDecoration: "none",
};
