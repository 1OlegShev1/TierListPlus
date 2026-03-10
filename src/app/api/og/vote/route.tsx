import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

function clampText(value: string | null, fallback: string, maxLength: number): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = clampText(searchParams.get("title"), "TierList+ Vote", 80);
  const status = clampText(searchParams.get("status"), "Collaborative Tier Ranking", 48);

  return new ImageResponse(
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background:
          "linear-gradient(135deg, rgba(10,10,10,1) 0%, rgba(24,24,24,1) 50%, rgba(46,32,18,1) 100%)",
        color: "rgb(245 245 245)",
        padding: "64px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          borderRadius: "999px",
          border: "2px solid rgba(245, 158, 11, 0.45)",
          color: "rgb(245 158 11)",
          padding: "10px 18px",
          fontSize: "26px",
          fontWeight: 700,
          letterSpacing: "0.02em",
          width: "fit-content",
        }}
      >
        TierList+
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <div
          style={{
            fontSize: "60px",
            lineHeight: 1.12,
            fontWeight: 800,
            maxWidth: "1000px",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: "34px",
            lineHeight: 1.25,
            color: "rgba(229, 231, 235, 0.92)",
            fontWeight: 500,
          }}
        >
          {status}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "rgba(229, 231, 235, 0.82)",
          fontSize: "24px",
        }}
      >
        <div>Rank together</div>
        <div style={{ color: "rgb(245 158 11)", fontWeight: 700 }}>tierlistplus</div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
