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
  const title = clampText(searchParams.get("title"), "TierList+ invite", 80);
  const status = clampText(searchParams.get("status"), "Open now", 48);

  return new ImageResponse(
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        background:
          "radial-gradient(circle at 15% 20%, rgba(245, 158, 11, 0.24) 0%, rgba(245, 158, 11, 0) 36%), linear-gradient(140deg, rgb(18 18 22) 0%, rgb(27 27 35) 45%, rgb(17 22 34) 100%)",
        color: "rgb(245 245 245)",
        padding: "64px",
        fontFamily: "Arial, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-120px",
          right: "-90px",
          width: "360px",
          height: "360px",
          borderRadius: "999px",
          background: "rgba(56, 189, 248, 0.12)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-160px",
          left: "-120px",
          width: "420px",
          height: "420px",
          borderRadius: "999px",
          background: "rgba(245, 158, 11, 0.1)",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", gap: "34px", flex: 1 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            maxWidth: "720px",
          }}
        >
          <div
            style={{
              fontSize: "62px",
              lineHeight: 1.1,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                alignSelf: "flex-start",
                borderRadius: "999px",
                border: "2px solid rgba(245, 158, 11, 0.5)",
                color: "rgb(245 158 11)",
                padding: "10px 18px",
                fontSize: "24px",
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              TierList+
            </div>
            <div
              style={{
                fontSize: "26px",
                lineHeight: 1.2,
                color: "rgba(229, 231, 235, 0.9)",
                fontWeight: 500,
              }}
            >
              {status}
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            width: "320px",
            padding: "18px",
            borderRadius: "20px",
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          {[
            { label: "S", color: "#ef4444" },
            { label: "A", color: "#f97316" },
            { label: "B", color: "#f59e0b" },
            { label: "C", color: "#84cc16" },
            { label: "D", color: "#38bdf8" },
          ].map((tier) => (
            <div
              key={tier.label}
              style={{
                display: "flex",
                alignItems: "center",
                height: "48px",
                borderRadius: "12px",
                overflow: "hidden",
                background: "rgba(17, 24, 39, 0.92)",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "100%",
                  background: tier.color,
                  color: "rgba(0, 0, 0, 0.82)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "26px",
                }}
              >
                {tier.label}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "0 14px",
                  color: "rgba(229, 231, 235, 0.8)",
                  fontSize: "18px",
                }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "999px",
                    background: "rgba(229, 231, 235, 0.8)",
                  }}
                />
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "999px",
                    background: "rgba(229, 231, 235, 0.5)",
                  }}
                />
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "999px",
                    background: "rgba(229, 231, 235, 0.3)",
                  }}
                />
              </div>
            </div>
          ))}
          <div
            style={{
              color: "rgba(229, 231, 235, 0.82)",
              fontSize: "18px",
              marginTop: "6px",
            }}
          >
            Rank together. Compare picks.
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "rgba(229, 231, 235, 0.82)",
          fontSize: "22px",
          marginTop: "22px",
        }}
      >
        <div>tierlistplus.com</div>
        <div style={{ color: "rgb(245 158 11)", fontWeight: 700 }}>TIERLIST+</div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
