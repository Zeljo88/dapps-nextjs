interface Props {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: string;
}

export default function StatCard({ label, value, sub, color = "#8b5cf6", icon }: Props) {
  return (
    <div className="card" style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{sub}</div>
          )}
        </div>
        {icon && (
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${color}22`,
            border: `1px solid ${color}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>{icon}</div>
        )}
      </div>
      <div style={{ marginTop: 16, height: 2, background: "var(--border)", borderRadius: 1 }}>
        <div style={{ width: "100%", height: "100%", background: `linear-gradient(90deg, ${color}, transparent)`, borderRadius: 1 }} />
      </div>
    </div>
  );
}
