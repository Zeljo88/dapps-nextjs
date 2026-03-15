"use client";
import { useEffect, useRef } from "react";

// Partner credentials
const PARTNER_NAME = "dappsoncardano";
const PARTNER_CODE = "doc61646472317139727..bfef95601890afd80709";

export default function SwapWidget() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Use iframe approach - most reliable for Next.js
  const iframeSrc = `https://swap.dexhunter.io?partnerName=${PARTNER_NAME}&partnerCode=${PARTNER_CODE}`;

  return (
    <div ref={containerRef} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <iframe
        src={iframeSrc}
        width="450"
        height="680"
        frameBorder="0"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "var(--bg-card)",
          maxWidth: "100%",
        }}
        allow="clipboard-read; clipboard-write"
        title="DexHunter Swap"
      />
    </div>
  );
}
