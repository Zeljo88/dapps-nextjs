"use client";
import { useCurrency } from "@/lib/currency";

export default function CurrencyToggle({ adaPrice }: { adaPrice: number }) {
  const { currency, toggle } = useCurrency();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {adaPrice > 0 && (
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          1 ₳ = ${adaPrice.toFixed(4)}
        </span>
      )}
      <button
        onClick={toggle}
        title="Toggle currency"
        style={{
          display: "flex", alignItems: "center",
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 8, overflow: "hidden", cursor: "pointer", padding: 0,
        }}
      >
        {(["ADA", "USD"] as const).map(c => (
          <span key={c} style={{
            padding: "5px 12px", fontSize: 13, fontWeight: 700,
            transition: "all 0.15s",
            background: currency === c ? "var(--accent)" : "transparent",
            color: currency === c ? "white" : "var(--text-muted)",
          }}>
            {c === "ADA" ? "₳" : "$"}
          </span>
        ))}
      </button>
    </div>
  );
}
