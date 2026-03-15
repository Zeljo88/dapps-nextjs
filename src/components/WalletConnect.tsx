"use client";
import { useState, useEffect } from "react";

const ADRIA_POOL_ID = "pool1we9umarzn0l6jp8mcm98y28lxuuzcurzpjldnjwtgdhgw068mnr";

const WALLETS = [
  { name: "eternl",      label: "Eternl",      icon: "💎" },
  { name: "nami",        label: "Nami",         icon: "🐙" },
  { name: "lace",        label: "Lace",         icon: "🎀" },
  { name: "vespr",       label: "Vespr",        icon: "🔮" },
  { name: "flint",       label: "Flint",        icon: "🔥" },
  { name: "typhoncip30", label: "Typhon",       icon: "🌪️" },
  { name: "nufi",        label: "NuFi",         icon: "🌊" },
  { name: "begin",       label: "Begin",        icon: "🚀" },
];

interface WalletState {
  connected: boolean;
  address: string;
  balance: string;
  name: string;
  icon: string;
}

export default function WalletConnect() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stakeStatus, setStakeStatus] = useState("");

  // Detect installed wallets
  const [installedWallets, setInstalledWallets] = useState<typeof WALLETS>([]);
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).cardano) {
      const detected = WALLETS.filter(w => !!(window as any).cardano[w.name]);
      setInstalledWallets(detected);
    }
  }, []);

  async function connectWallet(walletName: string) {
    setLoading(true);
    setError("");
    try {
      const cardano = (window as any).cardano;
      if (!cardano?.[walletName]) throw new Error("Wallet not found");

      const api = await cardano[walletName].enable();

      // Get balance
      const balanceHex = await api.getBalance();
      const balanceLovelace = parseInt(balanceHex, 16);
      const balanceAda = (balanceLovelace / 1_000_000).toFixed(2);

      // Get address
      const addresses = await api.getUsedAddresses();
      const address = addresses[0] || "";
      const shortAddr = address ? `${address.slice(0, 8)}...${address.slice(-6)}` : "";

      const w = WALLETS.find(w => w.name === walletName)!;
      setWallet({
        connected: true,
        address: shortAddr,
        balance: balanceAda,
        name: w.label,
        icon: w.icon,
      });
      setShowModal(false);
    } catch (e: any) {
      setError(e.message || "Failed to connect");
    }
    setLoading(false);
  }

  async function stakeWithAdria() {
    if (!wallet) { setShowModal(true); return; }
    setStakeStatus("loading");
    try {
      const cardano = (window as any).cardano;
      // Find which wallet is connected
      const connectedWallet = WALLETS.find(w => w.label === wallet.name);
      if (!connectedWallet) throw new Error("Wallet not connected");
      const api = await cardano[connectedWallet.name].enable();

      // Build delegation tx using Lucid via CIP-30
      // Simple approach: open cardanoscan stake delegation URL
      // For full on-chain delegation we'd need Lucid/MeshJS tx builder
      window.open(
        `https://cardanoscan.io/pool/${ADRIA_POOL_ID}`,
        "_blank"
      );
      setStakeStatus("opened");
    } catch (e: any) {
      setStakeStatus("error");
    }
  }

  function disconnect() {
    setWallet(null);
    setStakeStatus("");
  }

  // Not connected
  if (!wallet) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 16px", borderRadius: 8,
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            color: "white", fontSize: 13, fontWeight: 600,
            cursor: "pointer", transition: "all 0.15s",
            backdropFilter: "blur(8px)",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
        >
          <span>🔗</span> Connect Wallet
        </button>

        {showModal && (
          <WalletModal
            wallets={installedWallets}
            onConnect={connectWallet}
            onClose={() => setShowModal(false)}
            loading={loading}
            error={error}
          />
        )}
      </>
    );
  }

  // Connected
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={disconnect}
        title="Click to disconnect"
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 14px", borderRadius: 8,
          background: "rgba(16,185,129,0.2)",
          border: "1px solid rgba(16,185,129,0.4)",
          color: "white", fontSize: 13, fontWeight: 600,
          cursor: "pointer", transition: "all 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(16,185,129,0.2)")}
      >
        <span>{wallet.icon}</span>
        <span style={{ color: "#10b981" }}>{wallet.balance} ₳</span>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{wallet.address}</span>
      </button>
    </div>
  );
}

function WalletModal({ wallets, onConnect, onClose, loading, error }: {
  wallets: typeof WALLETS;
  onConnect: (name: string) => void;
  onClose: () => void;
  loading: boolean;
  error: string;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 28, minWidth: 340, maxWidth: 400,
        boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
            Connect Wallet
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none",
            color: "var(--text-muted)", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: "#ef444420", border: "1px solid #ef444440",
            borderRadius: 8, color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {wallets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>
              No Cardano wallets detected.
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 12 }}>
              Install Eternl, Nami, Lace or Vespr browser extension and refresh.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {wallets.map(w => (
              <button key={w.name} onClick={() => onConnect(w.name)} disabled={loading}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                  background: "var(--bg-secondary)", border: "1px solid var(--border)",
                  color: "var(--text-primary)", fontSize: 15, fontWeight: 600,
                  transition: "all 0.15s", textAlign: "left", width: "100%",
                  opacity: loading ? 0.6 : 1,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                  (e.currentTarget as HTMLElement).style.background = "var(--accent-dim)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLElement).style.background = "var(--bg-secondary)";
                }}
              >
                <span style={{ fontSize: 24 }}>{w.icon}</span>
                <span>{w.label}</span>
                {loading && <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>connecting...</span>}
              </button>
            ))}
          </div>
        )}

        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 16, textAlign: "center" }}>
          By connecting, you agree to our terms. Non-custodial — we never access your funds.
        </p>
      </div>
    </div>
  );
}

// Standalone stake button for hero banner
export function StakeWithAdriaButton() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stakeSuccess, setStakeSuccess] = useState(false);
  const [installedWallets, setInstalledWallets] = useState<typeof WALLETS>([]);
  const [connectedApi, setConnectedApi] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).cardano) {
      setInstalledWallets(WALLETS.filter(w => !!(window as any).cardano[w.name]));
    }
  }, []);

  async function connectAndStake(walletName: string) {
    setLoading(true);
    setError("");
    try {
      const api = await (window as any).cardano[walletName].enable();
      setConnectedApi(api);

      // Build stake delegation transaction
      // Use Mesh SDK if available, otherwise open pool page
      try {
        const { BrowserWallet } = await import("@meshsdk/core");
        // Get reward addresses
        const rewardAddrs = await api.getRewardAddresses();
        if (!rewardAddrs?.length) throw new Error("No reward address found");

        // Build delegation tx
        const tx = await buildDelegationTx(api, rewardAddrs[0]);
        if (tx) {
          setStakeSuccess(true);
          setShowModal(false);
          return;
        }
      } catch (meshErr) {
        // Fallback: open cardanoscan
      }

      // Fallback: deep link to pool page
      window.open(`https://cardanoscan.io/pool/${ADRIA_POOL_ID}`, "_blank");
      setStakeSuccess(true);
      setShowModal(false);
    } catch (e: any) {
      setError(e.message || "Failed to connect");
    }
    setLoading(false);
  }

  async function buildDelegationTx(api: any, rewardAddr: string) {
    // Using CIP-30 raw tx building with Lucid/Mesh
    // For now open the pool delegation URL with the wallet connected
    window.open(
      `https://app.dexhunter.io/#/stake?pool=${ADRIA_POOL_ID}`,
      "_blank"
    );
    return true;
  }

  if (stakeSuccess) {
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)",
        borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#10b981",
      }}>
        ✅ Opening ADRIA Pool page...
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
          backdropFilter: "blur(8px)", borderRadius: 10,
          padding: "10px 20px", fontSize: 14, fontWeight: 600,
          color: "white", cursor: "pointer", transition: "all 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
      >
        🏊 Stake with ADRIA
      </button>

      {showModal && (
        <WalletModal
          wallets={installedWallets}
          onConnect={connectAndStake}
          onClose={() => setShowModal(false)}
          loading={loading}
          error={error}
        />
      )}
    </>
  );
}
