"use client";
import { useWallet, SUPPORTED_WALLETS } from "@/lib/wallet";

const WALLET_EMOJIS: Record<string, string> = {
  eternl: "💎", nami: "🐙", lace: "🎀", vespr: "🔮",
  flint: "🔥", typhoncip30: "🌪️", nufi: "🌊", begin: "🚀",
  gerowallet: "🦊", yoroi: "🟦",
};

export default function WalletModal({ onClose }: { onClose: () => void }) {
  const { installedWallets, connect, connecting, error } = useWallet();

  async function handleConnect(walletName: string) {
    await connect(walletName);
    onClose();
  }

  const allWallets = SUPPORTED_WALLETS.map(w => ({
    ...w,
    installed: installedWallets.some(iw => iw.name === w.name),
  })).sort((a, b) => (b.installed ? 1 : 0) - (a.installed ? 1 : 0));

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 9999,
      background: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }} onClick={onClose}>
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 20,
        padding: 28,
        width: "100%",
        maxWidth: 400,
        maxHeight: "80vh",
        overflowY: "auto",
        boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        position: "relative",
        zIndex: 10000,
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>
              Connect Wallet
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              Choose your Cardano wallet
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%", background: "var(--bg-secondary)",
            border: "1px solid var(--border)", color: "var(--text-muted)",
            cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: "10px 14px", background: "#ef444420", border: "1px solid #ef444440",
            borderRadius: 10, color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {/* Wallet list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {allWallets.map(w => (
            <button
              key={w.name}
              onClick={() => w.installed && handleConnect(w.name)}
              disabled={!w.installed || connecting}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px", borderRadius: 12, cursor: w.installed ? "pointer" : "default",
                background: "var(--bg-secondary)", border: "1px solid var(--border)",
                color: w.installed ? "var(--text-primary)" : "var(--text-muted)",
                fontSize: 15, fontWeight: 600, textAlign: "left", width: "100%",
                transition: "all 0.15s", opacity: connecting ? 0.7 : 1,
              }}
              onMouseEnter={e => {
                if (!w.installed) return;
                (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                (e.currentTarget as HTMLElement).style.background = "var(--accent-dim)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLElement).style.background = "var(--bg-secondary)";
              }}
            >
              <span style={{ fontSize: 26, lineHeight: 1 }}>{WALLET_EMOJIS[w.name] || "💳"}</span>
              <span style={{ flex: 1 }}>{w.label}</span>
              {w.installed ? (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999,
                  background: "#10b98120", color: "#10b981", border: "1px solid #10b98140",
                  fontWeight: 600 }}>Detected</span>
              ) : (
                <a href={getWalletUrl(w.name)} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999,
                    background: "var(--bg-card)", color: "var(--text-muted)",
                    border: "1px solid var(--border)", textDecoration: "none" }}>
                  Install
                </a>
              )}
            </button>
          ))}
        </div>

        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 20, textAlign: "center", lineHeight: 1.5 }}>
          Non-custodial — we never store your keys or access your funds without your signature.
        </p>
      </div>
    </div>
  );
}

function getWalletUrl(name: string): string {
  const urls: Record<string, string> = {
    eternl: "https://eternl.io",
    nami: "https://namiwallet.io",
    lace: "https://www.lace.io",
    vespr: "https://vespr.xyz",
    flint: "https://flint-wallet.com",
    typhoncip30: "https://typhonwallet.io",
    nufi: "https://nu.fi",
    begin: "https://begin.is",
    gerowallet: "https://gerowallet.io",
    yoroi: "https://yoroi-wallet.com",
  };
  return urls[name] || "#";
}
