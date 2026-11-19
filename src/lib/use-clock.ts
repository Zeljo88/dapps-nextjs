"use client";
import { useEffect, useState } from "react";

export function useClock(initial: number) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const update = () => setNow(Date.now() / 1000);
    const first = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 15000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(first); window.clearInterval(timer);
      window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return Math.max(now, initial);
}
