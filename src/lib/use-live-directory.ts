"use client";
import { useEffect, useState } from "react";
import type { LiveDirectorySnapshot } from "./live-directory";

export function useLiveDirectory(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<{ data: LiveDirectorySnapshot; checkedAt: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let controller: AbortController | null = null;
    const load = async () => {
      if (document.visibilityState === "hidden" || controller) return;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 20000);
      try {
        const response = await fetch("/api/activity", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Live observations unavailable");
        const data = await response.json() as LiveDirectorySnapshot;
        if (!disposed) setSnapshot({ data, checkedAt: Date.now() / 1000 });
      } catch { if (!disposed) setSnapshot(null); }
      finally { window.clearTimeout(timeout); controller = null; }
    };
    const first = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 30000);
    window.addEventListener("focus", load); document.addEventListener("visibilitychange", load);
    return () => {
      disposed = true; controller?.abort(); window.clearTimeout(first); window.clearInterval(timer);
      window.removeEventListener("focus", load); document.removeEventListener("visibilitychange", load);
    };
  }, [enabled]);
  return snapshot;
}
