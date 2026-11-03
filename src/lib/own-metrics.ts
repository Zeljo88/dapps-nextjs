import type { OwnMetrics } from "./analytics";

export function metricDateTime(value: number): string {
  return new Date(value * 1000).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";
}

export function matchingOwnMetrics(metrics: OwnMetrics | null, slug: string, registryDigest: string): OwnMetrics | null {
  return metrics?.source === "own-cardano-node" && metrics.slug === slug && metrics.registryDigest === registryDigest ? metrics : null;
}

export function formatAda(value: string | null | undefined): string {
  if (!value || !/^\d+$/.test(value)) return "—";
  const lovelace = BigInt(value);
  const whole = (lovelace / BigInt(1000000)).toLocaleString("en-US");
  const fraction = (lovelace % BigInt(1000000)).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}${fraction ? "." + fraction : ""} ADA`;
}
