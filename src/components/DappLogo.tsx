"use client";
import { useState } from "react";
import { dappLogo } from "@/lib/dapp-view";

export default function DappLogo({ slug, name, size = 64 }: { slug: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return <div style={{ width: size, height: size, borderRadius: size / 4, flexShrink: 0, background: "#8b5cf620", border: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size / 2, fontWeight: 700, color: "#8b5cf6", overflow: "hidden" }}>
    {failed ? name.charAt(0) : /* eslint-disable-next-line @next/next/no-img-element */
      <img src={dappLogo(slug)} alt={name} width={size} height={size} style={{ objectFit: "cover" }} onError={() => setFailed(true)} />}
  </div>;
}
