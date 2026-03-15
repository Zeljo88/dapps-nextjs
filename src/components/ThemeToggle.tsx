"use client";
import { useTheme } from "@/lib/theme";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      style={{
        width: 36, height: 36,
        borderRadius: 8,
        background: "transparent",
        border: "1px solid var(--border)",
        cursor: "pointer",
        fontSize: 17,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
        color: "var(--text-secondary)",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-light)";
        (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
      }}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
