import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "DApps on Cardano — Observed Contract Activity";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0f0f1a 0%, #1a1035 50%, #0d1a2e 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Purple glow orb top-left */}
        <div
          style={{
            position: "absolute",
            top: -60,
            left: -60,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, #8b5cf650 0%, transparent 70%)",
          }}
        />
        {/* Blue glow orb bottom-right */}
        <div
          style={{
            position: "absolute",
            bottom: -60,
            right: -60,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, #3b82f650 0%, transparent 70%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 1,
            padding: "0 80px",
            textAlign: "center",
          }}
        >
          {/* Logo badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 80,
              height: 80,
              borderRadius: 20,
              background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
              marginBottom: 32,
              fontSize: 44,
              fontWeight: 900,
              color: "#ffffff",
            }}
          >
            D
          </div>

          {/* Main title */}
          <div
            style={{
              fontSize: 68,
              fontWeight: 800,
              color: "#ffffff",
              lineHeight: 1.1,
              marginBottom: 20,
              letterSpacing: "-1px",
            }}
          >
            DApps on Cardano
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 30,
              color: "#a78bfa",
              marginBottom: 40,
              fontWeight: 500,
            }}
          >
            Observed Contract Activity
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              color: "#94a3b8",
              fontSize: 20,
            }}
          >
            <span>Our Mainnet Node</span>
            <span style={{ color: "#4b5563" }}>·</span>
            <span>Published Coverage</span>
            <span style={{ color: "#4b5563" }}>·</span>
            <span>Transaction Evidence</span>
            <span style={{ color: "#4b5563" }}>·</span>
            <span>Open Methodology</span>
          </div>
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, #8b5cf6, #3b82f6, #06b6d4)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
