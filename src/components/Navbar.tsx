"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CurrencyToggle from "./CurrencyToggle";
import ThemeToggle from "./ThemeToggle";

export default function Navbar({ adaPrice = 0 }: { adaPrice?: number }) {
  const path = usePathname();
  const links = [
    { href: "/", label: "DApps" },
    { href: "/ecosystem", label: "Ecosystem" },
    { href: "/yields", label: "Yields" },
  ];

  return (
    <nav style={{
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

        {/* Nav links */}
        <div style={{ display: "flex", gap: 2 }}>
          {links.map(l => {
            const active = path === l.href;
            return (
              <Link key={l.href} href={l.href} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 14, fontWeight: 500,
                textDecoration: "none",
                color: active ? "white" : "rgba(255,255,255,0.7)",
                background: active ? "rgba(255,255,255,0.18)" : "transparent",
                border: active ? "1px solid rgba(255,255,255,0.25)" : "1px solid transparent",
                transition: "all 0.15s",
              }}>{l.label}</Link>
            );
          })}
        </div>

        {/* Right side controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {/* Live indicator */}
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)",
              boxShadow: "0 0 6px var(--green)" }} />
            Mainnet
          </div>

          {/* ADA/USD toggle */}
          <CurrencyToggle adaPrice={adaPrice} />

          {/* Dark/Light toggle */}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
