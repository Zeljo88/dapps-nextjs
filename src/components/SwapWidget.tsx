"use client";
import { useEffect, useRef } from "react";

// Partner credentials
const PARTNER_NAME = "dappsoncardano";
const PARTNER_CODE = "doc6164647231713972747a353239376177656567763334383973656c73337865353766766d3372377a396a633968307a3968366d356a67797837783977393868707a30707672617a3463666d6e3832726a3334356e6371787478677463667936787332367a766835da39a3ee5e6b4b0d3255bfef95601890afd80709";

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
