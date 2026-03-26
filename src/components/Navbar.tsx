"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CurrencyToggle from "./CurrencyToggle";
import ThemeToggle from "./ThemeToggle";
import WalletConnect from "./WalletConnect";

export default function Navbar({ adaPrice = 0 }: { adaPrice?: number }) {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [path]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const links = [
    { href: "/", label: "DApps", icon: "📊" },
    { href: "/category", label: "Categories", icon: "🗂️" },
    { href: "/ecosystem", label: "Ecosystem", icon: "🌐" },
    { href: "/yields", label: "Yields", icon: "🌾" },
    { href: "/portfolio", label: "Portfolio", icon: "💼" },
    { href: "/swap", label: "Swap", icon: "🔄" },
  ];

  return (
    <>
      <nav className="navbar" style={{
        background: "var(--nav-bg)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 60,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>

          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #0066ff, #00c6a2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17, fontWeight: 800, color: "white",
            }}>₳</div>
            <span style={{ fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,0.95)",
              letterSpacing: "-0.01em" }}>
              DApps on Cardano
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="nav-links-desktop" style={{ display: "flex", gap: 2 }}>
            {links.map(l => {
              const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
              return (
                <Link key={l.href} href={l.href} style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: 14, fontWeight: 500,
                  textDecoration: "none",
                  color: active ? "white" : "rgba(255,255,255,0.7)",
                  background: active ? "rgba(255,255,255,0.18)" : "transparent",
                  border: active ? "1px solid rgba(255,255,255,0.25)" : "1px solid transparent",
                  transition: "all 0.15s",
                }}>{l.icon} {l.label}</Link>
              );
            })}
          </div>

          {/* Desktop right side controls */}
          <div className="nav-controls-desktop" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)",
                boxShadow: "0 0 6px var(--green)" }} />
              Mainnet
            </div>
            <CurrencyToggle adaPrice={adaPrice} />
            <ThemeToggle />
            <WalletConnect />
          </div>

          {/* Mobile hamburger */}
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            style={{
              display: "none", /* shown via CSS on mobile */
              background: "none", border: "none", cursor: "pointer",
              padding: 8, color: "rgba(255,255,255,0.9)", fontSize: 22,
              lineHeight: 1,
            }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* Mobile slide-out menu */}
      {menuOpen && (
        <div className="nav-mobile-overlay" onClick={() => setMenuOpen(false)}
          style={{
            position: "fixed", inset: 0, top: 60, zIndex: 49,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
          }}
        />
      )}
      <div className="nav-mobile-menu" style={{
        position: "fixed", top: 60, right: 0, bottom: 0, zIndex: 49,
        width: 280, background: "var(--bg-card)", borderLeft: "1px solid var(--border)",
        transform: menuOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s ease",
        display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Nav links */}
        <div style={{ padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
          {links.map(l => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 24px", textDecoration: "none",
                  fontSize: 16, fontWeight: active ? 700 : 500,
                  color: active ? "var(--accent)" : "var(--text-primary)",
                  background: active ? "var(--accent-dim)" : "transparent",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 18 }}>{l.icon}</span>
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* Controls */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Currency</span>
            <CurrencyToggle adaPrice={adaPrice} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Theme</span>
            <ThemeToggle />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)",
              boxShadow: "0 0 6px var(--green)" }} />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Cardano Mainnet</span>
          </div>
        </div>

        {/* Wallet connect at bottom */}
        <div style={{ padding: "16px 24px", marginTop: "auto", borderTop: "1px solid var(--border)" }}>
          <WalletConnect />
        </div>
      </div>
    </>
  );
}
