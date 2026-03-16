"use client";
import { useState, useRef, useEffect } from "react";
import { useWallet } from "@/lib/wallet";
import WalletModal from "./WalletModal";
import Link from "next/link";

export default function WalletConnect() {
  const { wallet, disconnect } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const balAda = wallet ? (wallet.balanceLovelace / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (wallet) {
    return (
      <div ref={dropdownRef} style={{ position: "relative" }}>
        {/* Connected button */}
        <button
          onClick={() => setShowDropdown(v => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 14px", borderRadius: 8, cursor: "pointer",
            background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)",
            color: "white", fontSize: 13, fontWeight: 600, transition: "all 0.15s",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981",
            display: "inline-block", boxShadow: "0 0 6px #10b981", flexShrink: 0 }} />
          <span style={{ color: "#10b981" }}>{balAda} ₳</span>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{wallet.address}</span>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginLeft: 2 }}>▾</span>
        </button>

        {/* Dropdown */}
        {showDropdown && (
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0,
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 12, padding: 8, minWidth: 200,
            boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
            zIndex: 1000,
          }}>
            {/* Wallet info */}
            <div style={{ padding: "8px 12px 12px", borderBottom: "1px solid var(--border)", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Connected via {wallet.label}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace", wordBreak: "break-all" }}>
                {wallet.address}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#10b981", marginTop: 6 }}>
                {balAda} ₳
              </div>
            </div>

            {/* Portfolio link */}
            <Link
              href="/portfolio"
              onClick={() => setShowDropdown(false)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8,
                color: "var(--text-primary)", textDecoration: "none",
                fontSize: 14, fontWeight: 500,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span>💼</span>
              <span>My Portfolio</span>
            </Link>

            {/* Disconnect */}
            <button
              onClick={() => { disconnect(); setShowDropdown(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                background: "transparent", border: "none",
                color: "#ef4444", fontSize: 14, fontWeight: 500,
                transition: "background 0.15s", textAlign: "left",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span>🔌</span>
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>
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
