"use client";
import { useState } from "react";

export default function CategoryFAQ({ faqs }: { faqs: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {faqs.map((f, i) => (
        <div key={i} className="card" style={{ overflow: "hidden" }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              width: "100%", padding: "16px 20px", background: "none", border: "none",
              cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
              textAlign: "left", color: "var(--text-primary)", fontSize: 15, fontWeight: 600,
            }}
          >
            {f.q}
            <span style={{ fontSize: 18, color: "var(--text-muted)", marginLeft: 12, flexShrink: 0, transition: "transform 0.2s", transform: open === i ? "rotate(180deg)" : "rotate(0)" }}>
              ▾
            </span>
          </button>
          {open === i && (
            <div style={{ padding: "0 20px 16px 20px", color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.7 }}>
              {f.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
