import { fmt, fmtNum } from "@/lib/api";

export default function CompactStat({ label, value, color, isCurrency, isPrice, detail }: {
  label: string; value: number | null; color: string;
  isCurrency?: boolean; isPrice?: boolean; detail?: string;
}) {
  const display = value === null ? "—" : isPrice ? `$${value.toFixed(4)}` : isCurrency ? fmt(value) : fmtNum(value);
  return <div className="card" aria-label={`${label}: ${value === null ? "Unavailable" : display}`}
    title={detail ?? (value === null ? "Unavailable in the current validated feed" : undefined)}
    style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, height: "100%", minWidth: 0, boxSizing: "border-box" }}>
    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
    <span style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1, whiteSpace: "nowrap" }}>{display}</span>
  </div>;
}
