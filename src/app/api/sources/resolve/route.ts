import { NextResponse } from "next/server";
import { INVALID_ITEM_SOURCE_MESSAGE } from "@/lib/item-source";
import { takeRateLimitToken } from "@/lib/rate-limit";
import { resolveSourcePreview } from "@/lib/source-preview-resolver";

export const dynamic = "force-dynamic";
const SOURCE_RESOLVE_RATE_LIMIT_MAX_REQUESTS = 90;
const SOURCE_RESOLVE_RATE_LIMIT_WINDOW_MS = 60_000;
const SOURCE_RESOLVE_MAX_URL_LENGTH = 500;
const IPV4_RE = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6_RE = /^[0-9a-f:]+$/i;

function normalizeIpCandidate(value: string | null | undefined): string | null {
  if (!value) return null;
  let candidate = value.trim().toLowerCase();
  if (!candidate || candidate === "unknown") return null;

  if (candidate.startsWith("[") && candidate.includes("]")) {
    const closeBracket = candidate.indexOf("]");
    candidate = candidate.slice(1, closeBracket);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.replace(/:\d+$/, "");
  }

  if (IPV4_RE.test(candidate)) return candidate;
  if (candidate.includes(":") && IPV6_RE.test(candidate)) return candidate;
  return null;
}

function normalizeUserAgent(value: string | null | undefined): string {
  if (!value) return "unknown";
  return value.trim().replace(/\s+/g, " ").slice(0, 120) || "unknown";
}

function getSourceResolveClientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0];
  const clientIp =
    normalizeIpCandidate(forwardedFor) ??
    normalizeIpCandidate(request.headers.get("x-real-ip")) ??
    null;
  if (clientIp) {
    return `source-resolve:ip:${clientIp}`;
  }

  const userAgent = normalizeUserAgent(request.headers.get("user-agent"));
  return `source-resolve:ua:${userAgent}`;
}

export async function GET(request: Request) {
  const rateLimit = takeRateLimitToken({
    key: getSourceResolveClientKey(request),
    maxRequests: SOURCE_RESOLVE_RATE_LIMIT_MAX_REQUESTS,
    windowMs: SOURCE_RESOLVE_RATE_LIMIT_WINDOW_MS,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many source preview requests. Please try again in a minute." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const sourceUrl = searchParams.get("url")?.trim() ?? "";
  const parent = searchParams.get("parent")?.trim() ?? null;

  if (!sourceUrl) {
    return NextResponse.json({ error: INVALID_ITEM_SOURCE_MESSAGE }, { status: 400 });
  }
  if (sourceUrl.length > SOURCE_RESOLVE_MAX_URL_LENGTH) {
    return NextResponse.json({ error: INVALID_ITEM_SOURCE_MESSAGE }, { status: 400 });
  }

  try {
    const resolution = await resolveSourcePreview(sourceUrl, parent);
    return NextResponse.json(resolution, {
      status: 200,
      headers: {
        "cache-control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: INVALID_ITEM_SOURCE_MESSAGE }, { status: 400 });
  }
}
