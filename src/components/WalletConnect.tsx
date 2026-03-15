"use client";
import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import WalletModal from "./WalletModal";

export default function WalletConnect() {
  const { wallet, disconnect } = useWallet();
  const [showModal, setShowModal] = useState(false);

  const balAda = wallet ? (wallet.balanceLovelace / 1_000_000).toFixed(2) : "0";

  if (wallet) {
    return (
      <button
        onClick={disconnect}
        title="Disconnect wallet"
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 14px", borderRadius: 8, cursor: "pointer",
          background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)",
          color: "white", fontSize: 13, fontWeight: 600, transition: "all 0.15s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "rgba(239,68,68,0.2)";
          e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "rgba(16,185,129,0.2)";
          e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)";
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981",
          display: "inline-block", boxShadow: "0 0 6px #10b981" }} />
        <span style={{ color: "#10b981" }}>{balAda} ₳</span>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{wallet.address}</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 16px", borderRadius: 8, cursor: "pointer",
          background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
          color: "white", fontSize: 13, fontWeight: 600, transition: "all 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
      >
        🔗 Connect Wallet
      </button>
      {showModal && <WalletModal onClose={() => setShowModal(false)} />}
    </>
  );
}
