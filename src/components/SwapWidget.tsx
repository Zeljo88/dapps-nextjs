"use client";
import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import WalletModal from "./WalletModal";

const PARTNER_NAME = "dappsoncardano";
const PARTNER_CODE = "doc6164647231713972747a353239376177656567763334383973656c73337865353766766d3372377a396a633968307a3968366d356a67797837783977393868707a30707672617a3463666d6e3832726a3334356e6371787478677463667936787332367a766835da39a3ee5e6b4b0d3255bfef95601890afd80709";

// Dynamic import to avoid SSR issues with the Swap component
import dynamic from "next/dynamic";
const DexHunterSwap = dynamic(
  () => import("@dexhunterio/swaps").then(m => ({ default: m.default })),
  { ssr: false, loading: () => <SwapSkeleton /> }
);

export default function SwapWidget() {
  const { wallet } = useWallet();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <DexHunterSwap
          partnerName={PARTNER_NAME}
          partnerCode={PARTNER_CODE}
          width="100%"
          // Pass connected wallet name so DexHunter knows it's already connected
          selectedWallet={wallet?.name as any}
          // When user clicks "Connect Wallet" inside the widget → open OUR modal
          onClickWalletConnect={() => setShowModal(true)}
          // Theme sync
          theme="dark"
          // Custom colors to match our dark theme
          colors={{
            background: "#16161f",
            containers: "#1e1e2a",
            mainText: "#f1f1f3",
            subText: "#9999b0",
            accent: "#8b5cf6",
            buttonText: "#ffffff",
          }}
          style={{ borderRadius: 16 }}
        />
      </div>

      {showModal && <WalletModal onClose={() => setShowModal(false)} />}
    </>
  );
}

function SwapSkeleton() {
  return (
    <div style={{
      width: "100%", height: 500, borderRadius: 16,
      background: "var(--bg-card)", border: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 12,
    }}>
      <div style={{ width: 32, height: 32, border: "3px solid var(--border)",
        borderTopColor: "var(--accent)", borderRadius: "50%",
        animation: "spin 0.8s linear infinite" }} />
      <span style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading swap...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
