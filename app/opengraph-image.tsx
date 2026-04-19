import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Falcon's Paths · MTB Marathon · Bajina Bašta";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a1410",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "#f4ece0",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 4,
              border: "1px solid rgba(200, 115, 42, 0.5)",
              background: "rgba(200, 115, 42, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#e8a55c",
              fontSize: 22,
            }}
          >
            ◐
          </div>
          <div style={{ fontSize: 14, letterSpacing: 6, textTransform: "uppercase", color: "#e8a55c" }}>
            Putevi Sokola · Bajina Bašta · 2026
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 128, lineHeight: 0.95, fontStyle: "italic", fontWeight: 300 }}>Falcon's</div>
          <div style={{ fontSize: 128, lineHeight: 0.95, color: "#e8a55c" }}>Paths.</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, color: "#d8cfc0", letterSpacing: 2, textTransform: "uppercase" }}>
          <div>43.2 km · 1,245 m climb · Velika Staza</div>
          <div>44.30°N · 19.48°E</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
