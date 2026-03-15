"use client";
import { createContext, useContext, useState, ReactNode } from "react";

type Currency = "USD" | "ADA";

interface CurrencyCtx {
  currency: Currency;
  toggle: () => void;
  format: (usdValue: number, adaPrice: number) => string;
}

const Ctx = createContext<CurrencyCtx>({
  currency: "ADA",
  toggle: () => {},
  format: (v, p) => `₳${p > 0 ? (v / p).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}`,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("ADA");
  const toggle = () => setCurrency(c => c === "ADA" ? "USD" : "ADA");

  const format = (usdValue: number, adaPrice: number): string => {
    if (!usdValue) return "—";
    if (currency === "USD") {
      if (usdValue >= 1_000_000_000) return `$${(usdValue / 1_000_000_000).toFixed(1)}B`;
      if (usdValue >= 1_000_000) return `$${(usdValue / 1_000_000).toFixed(2)}M`;
      if (usdValue >= 1_000) return `$${(usdValue / 1_000).toFixed(1)}K`;
      return `$${usdValue.toFixed(0)}`;
    }
    // ADA
    const ada = adaPrice > 0 ? usdValue / adaPrice : 0;
    if (ada >= 1_000_000_000) return `₳${(ada / 1_000_000_000).toFixed(1)}B`;
    if (ada >= 1_000_000) return `₳${(ada / 1_000_000).toFixed(1)}M`;
    if (ada >= 1_000) return `₳${(ada / 1_000).toFixed(1)}K`;
    return `₳${ada.toFixed(0)}`;
  };

  return <Ctx.Provider value={{ currency, toggle, format }}>{children}</Ctx.Provider>;
}

export const useCurrency = () => useContext(Ctx);
