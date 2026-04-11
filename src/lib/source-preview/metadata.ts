import { MAX_ITEM_LABEL_LENGTH } from "@/lib/item-source";
import type { OEmbedMetadata } from "@/lib/source-preview/types";

export function normalizeMetadataTitle(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, MAX_ITEM_LABEL_LENGTH) : null;
}

export function normalizeMetadataDescription(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 320) : null;
}

export function normalizeDurationSeconds(input: unknown): number | null {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input <= 0) return null;
    return Math.floor(input);
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.floor(parsed);
  }
  return null;
}

export function normalizeMetadataUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!["https:", "http:"].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function parseOEmbedMetadata(payload: {
  title?: unknown;
  thumbnail_url?: unknown;
  duration?: unknown;
}): OEmbedMetadata {
  return {
    title: normalizeMetadataTitle(payload.title),
    thumbnailUrl: normalizeMetadataUrl(payload.thumbnail_url),
    durationSec: normalizeDurationSeconds(payload.duration),
  };
}

export function parseIso8601DurationToSeconds(input: string): number | null {
  const match = input.trim().match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (!match) return null;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = match[2] ? Number(match[2]) : 0;
  const seconds = match[3] ? Number(match[3]) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }
  const total = Math.floor(hours * 3600 + minutes * 60 + seconds);
  return total > 0 ? total : null;
}

export function extractYouTubeDurationSecondsFromHtml(html: string): number | null {
  const isoByOrderOne = html.match(
    /<meta[^>]+itemprop=["']duration["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  )?.[1];
  const isoByOrderTwo = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']duration["'][^>]*>/i,
  )?.[1];
  const isoDuration = isoByOrderOne ?? isoByOrderTwo;
  if (isoDuration) {
    const parsedIso = parseIso8601DurationToSeconds(isoDuration);
    if (parsedIso) return parsedIso;
  }

  const lengthSeconds = html.match(/"lengthSeconds":"(\d+)"/)?.[1];
  if (lengthSeconds) {
    const parsed = normalizeDurationSeconds(lengthSeconds);
    if (parsed) return parsed;
  }

  const approxDurationMs = html.match(/"approxDurationMs":"(\d+)"/)?.[1];
  if (approxDurationMs) {
    const parsedMs = normalizeDurationSeconds(approxDurationMs);
    if (parsedMs) {
      const seconds = Math.floor(parsedMs / 1000);
      return seconds > 0 ? seconds : null;
    }
  }

  return null;
}

function decodeHtmlMetaValue(input: string): string {
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

export function extractMetaTagContent(html: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedKey}["'][^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtmlMetaValue(match[1]);
    }
  }

  return null;
}

export function stripHtmlTags(input: string): string {
  return decodeHtmlMetaValue(input)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTitleTagContent(html: string): string | null {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (!title) return null;
  return stripHtmlTags(title);
}

export function extractCanonicalHref(html: string): string | null {
  const patterns = [
    /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i,
  ];
  for (const pattern of patterns) {
    const href = html.match(pattern)?.[1];
    if (href) return href;
  }
  return null;
}
