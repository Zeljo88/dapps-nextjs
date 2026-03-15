"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CurrencyToggle from "./CurrencyToggle";

export default function Navbar({ adaPrice = 0 }: { adaPrice?: number }) {
  const path = usePathname();
  const links = [
    { href: "/", label: "DApps" },
    { href: "/ecosystem", label: "Ecosystem" },
    { href: "/yields", label: "Yields" },
  ];

  return (
    <nav style={{
      background: "rgba(10,10,15,0.85)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--border)",
      position: "sticky", top: 0, zIndex: 50,
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>

        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800, color: "white"
          }}>₳</div>
          <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
            DApps on Cardano
          </span>
        </Link>

        {/* Links */}
        <div style={{ display: "flex", gap: 4 }}>
          {links.map(l => (
            <Link key={l.href} href={l.href} style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 14, fontWeight: 500,
              textDecoration: "none",
              color: path === l.href ? "white" : "var(--text-secondary)",
              background: path === l.href ? "var(--accent-dim)" : "transparent",
              border: path === l.href ? "1px solid rgba(139,92,246,0.3)" : "1px solid transparent",
              transition: "all 0.15s",
            }}>{l.label}</Link>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)" }} />
            Mainnet
          </div>
          <CurrencyToggle adaPrice={adaPrice} />
        </div>
      </div>
    </nav>
  );
}
