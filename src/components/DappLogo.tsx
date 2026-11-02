"use client";
import { useCallback, useState } from "react";
import { dappLogo } from "@/lib/dapp-view";

export default function DappLogo({ slug, name, size = 64, src }: { slug: string; name: string; size?: number; src?: string }) {
  const [failed, setFailed] = useState(false);
  const checkImage = useCallback((img: HTMLImageElement | null) => {
    // A cached image can fail before hydration attaches the error handler.
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  return <div style={{ width: size, height: size, borderRadius: size / 4, flexShrink: 0, background: "#8b5cf620", border: "1px solid var(--border-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size / 2, fontWeight: 700, color: "#8b5cf6", overflow: "hidden" }}>
    {failed ? name.charAt(0) : /* eslint-disable-next-line @next/next/no-img-element */
      <img ref={checkImage} src={src ?? dappLogo(slug)} alt={name} width={size} height={size} style={{ objectFit: "cover" }} onError={() => setFailed(true)} />}
  </div>;
}
