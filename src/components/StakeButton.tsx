"use client";
import { useState } from "react";
import { useWallet, ADRIA_POOL_ID } from "@/lib/wallet";
import WalletModal from "./WalletModal";

type Status = "idle" | "building" | "signing" | "submitting" | "success" | "error";

export default function StakeButton() {
  const { wallet, delegate } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [txHash, setTxHash] = useState("");
  const [errMsg, setErrMsg] = useState("");

  async function handleStake() {
    if (!wallet) { setShowModal(true); return; }

    setStatus("building");
    setErrMsg("");

    const result = await delegate();

    if (result.txHash) {
      setTxHash(result.txHash);
      setStatus("success");
    } else {
      setErrMsg(result.error || "Unknown error");
      setStatus("error");
    }
  }

  // Success state
  if (status === "success") {
    return (
      <a
        href={`https://cardanoscan.io/transaction/${txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(16,185,129,0.25)", border: "1px solid rgba(16,185,129,0.5)",
          borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600,
          color: "#10b981", textDecoration: "none",
        }}
      >
        ✅ Delegated! View tx ↗
      </a>
    );
  }

  const isLoading = ["building", "signing", "submitting"].includes(status);
  const labels: Record<Status, string> = {
    idle: "🏊 Stake with ADRIA",
    building: "Building tx...",
    signing: "Sign in wallet...",
    submitting: "Submitting...",
    success: "✅ Done!",
    error: "🏊 Try Again",
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
        <button
          onClick={handleStake}
          disabled={isLoading}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: isLoading ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            backdropFilter: "blur(8px)", borderRadius: 10,
            padding: "10px 20px", fontSize: 14, fontWeight: 600,
            color: "white", cursor: isLoading ? "wait" : "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = "rgba(255,255,255,0.25)"; }}
          onMouseLeave={e => { if (!isLoading) e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
        >
          {isLoading && (
            <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: "white", borderRadius: "50%",
              display: "inline-block", animation: "spin 0.8s linear infinite" }} />
          )}
          {labels[status]}
        </button>

        {status === "error" && (
          <span style={{ fontSize: 12, color: "#ef4444", maxWidth: 300 }}>{errMsg}</span>
        )}

        {!wallet && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
            Connect wallet first to delegate
          </span>
        )}
      </div>

      {showModal && <WalletModal onClose={() => setShowModal(false)} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
