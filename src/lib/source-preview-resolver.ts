import {
  buildExternalSourceEmbedUrl,
  detectExternalSourceKind,
  type ExternalSourceKind,
  type ExternalSourceResolver,
  getExternalSourceCapability,
  type ItemSourceProvider,
  parseAnyItemSource,
} from "@/lib/item-source";

export type SourcePreviewEmbedType = "iframe" | "image" | "video" | "audio" | null;

export interface SourcePreviewResolution {
  sourceUrl: string;
  provider: ItemSourceProvider | null;
  youtubeContentKind: "VIDEO" | "SHORTS" | null;
  kind: ExternalSourceKind | null;
  label: string;
  embedUrl: string | null;
  embedType: SourcePreviewEmbedType;
  note: string | null;
  resolvedBy: "native" | "resolver" | "none";
}

interface CacheEntry {
  expiresAt: number;
  value: SourcePreviewResolution;
}

interface ResolveSourcePreviewOptions {
  detectYouTubeContentKind?: boolean;
}

const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
const PREVIEW_CACHE_MAX_ENTRIES = 500;
const OEMBED_FETCH_TIMEOUT_MS = 4_000;
const MAX_RESOLVER_REDIRECTS = 4;
const previewCache = new Map<string, CacheEntry>();

const RESOLVER_HOST_ALLOWLIST: Record<ExternalSourceResolver, Set<string>> = {
  SOUNDCLOUD_OEMBED: new Set([
    "soundcloud.com",
    "www.soundcloud.com",
    "m.soundcloud.com",
    "on.soundcloud.com",
  ]),
  TIKTOK_OEMBED: new Set(["tiktok.com", "www.tiktok.com", "vm.tiktok.com"]),
  X_OEMBED: new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com"]),
  INSTAGRAM_OEMBED: new Set(["instagram.com", "www.instagram.com"]),
};

const RESOLVER_EMBED_HOST_ALLOWLIST: Record<ExternalSourceResolver, Set<string>> = {
  SOUNDCLOUD_OEMBED: new Set(["w.soundcloud.com"]),
  TIKTOK_OEMBED: new Set(),
  X_OEMBED: new Set(),
  INSTAGRAM_OEMBED: new Set(),
};

function getCacheKey(
  sourceUrl: string,
  parentHostname: string | null,
  detectYouTubeContentKind: boolean,
): string {
  return `${sourceUrl}::${parentHostname ?? ""}::ytkind:${detectYouTubeContentKind ? "1" : "0"}`;
}

function pruneCache(now: number) {
  for (const [cacheKey, entry] of previewCache) {
    if (entry.expiresAt <= now) {
      previewCache.delete(cacheKey);
    }
  }

  while (previewCache.size > PREVIEW_CACHE_MAX_ENTRIES) {
    const oldestKey = previewCache.keys().next().value;
    if (!oldestKey) break;
    previewCache.delete(oldestKey);
  }
}

function getCachedValue(cacheKey: string, now: number): SourcePreviewResolution | null {
  const entry = previewCache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    previewCache.delete(cacheKey);
    return null;
  }

  // Touch entry to keep recency ordering for bounded eviction.
  previewCache.delete(cacheKey);
  previewCache.set(cacheKey, entry);
  return entry.value;
}

function setCachedValue(cacheKey: string, value: SourcePreviewResolution, now: number) {
  previewCache.set(cacheKey, {
    expiresAt: now + PREVIEW_CACHE_TTL_MS,
    value,
  });
  pruneCache(now);
}

function getEmbedTypeForKind(kind: ExternalSourceKind | null): SourcePreviewEmbedType {
  if (!kind) return null;
  switch (kind) {
    case "IMAGE":
      return "image";
    case "VIDEO":
      return "video";
    case "AUDIO":
      return "audio";
    default:
      return "iframe";
  }
}

function isResolverHostAllowed(resolver: ExternalSourceResolver, host: string): boolean {
  return RESOLVER_HOST_ALLOWLIST[resolver].has(host);
}

function normalizeParentHostname(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim().toLowerCase().replace(/\.$/, "");
  if (!raw || raw.length > 253) return null;
  if (raw === "localhost") return raw;
  if (!/^[a-z0-9.-]+$/.test(raw)) return null;
  if (raw.includes("..") || raw.startsWith(".") || raw.endsWith(".")) return null;

  const labels = raw.split(".");
  if (
    labels.length < 2 ||
    labels.some(
      (label) =>
        label.length === 0 || label.length > 63 || label.startsWith("-") || label.endsWith("-"),
    )
  ) {
    return null;
  }

  return raw;
}

function isSafeResolvedEmbedUrl(resolver: ExternalSourceResolver, embedUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(embedUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;

  const allowedHosts = RESOLVER_EMBED_HOST_ALLOWLIST[resolver];
  if (allowedHosts.size === 0) return false;
  return allowedHosts.has(parsed.hostname.toLowerCase());
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return response;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseRedirectTarget(currentUrl: string, location: string): URL | null {
  try {
    const target = new URL(location, currentUrl);
    if (target.protocol !== "https:") return null;
    if (target.username || target.password) return null;
    return target;
  } catch {
    return null;
  }
}

async function resolveTrustedRedirectTarget(
  resolver: ExternalSourceResolver,
  sourceUrl: string,
): Promise<string | null> {
  let currentUrl = sourceUrl;
  for (let hop = 0; hop <= MAX_RESOLVER_REDIRECTS; hop += 1) {
    const response = await fetchWithTimeout(
      currentUrl,
      { redirect: "manual" },
      OEMBED_FETCH_TIMEOUT_MS,
    );
    if (!response) return null;

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      const target = parseRedirectTarget(currentUrl, location);
      if (!target) return null;

      const targetHost = target.hostname.toLowerCase();
      if (!isResolverHostAllowed(resolver, targetHost)) {
        return null;
      }

      currentUrl = target.toString();
      continue;
    }

    if (!response.ok) return null;
    return currentUrl;
  }

  return null;
}

async function resolveEmbedUrlViaOEmbed(
  resolver: ExternalSourceResolver,
  sourceUrl: string,
): Promise<string | null> {
  if (resolver === "SOUNDCLOUD_OEMBED") {
    const url = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(sourceUrl)}`;
    const response = await fetchWithTimeout(url, {}, OEMBED_FETCH_TIMEOUT_MS);
    if (!response?.ok) return null;
    const payload = (await response.json()) as { html?: unknown };
    if (typeof payload.html !== "string") return null;
    const match = payload.html.match(/src="([^"]+)"/i);
    if (!match?.[1]) return null;
    return isSafeResolvedEmbedUrl(resolver, match[1]) ? match[1] : null;
  }

  if (resolver === "TIKTOK_OEMBED") {
    const finalUrl = await resolveTrustedRedirectTarget(resolver, sourceUrl);
    if (!finalUrl) return null;
    return buildExternalSourceEmbedUrl(finalUrl, null);
  }

  if (resolver === "X_OEMBED") {
    // X oEmbed is also script/widget driven; no iframe URL is returned.
    return null;
  }

  if (resolver === "INSTAGRAM_OEMBED") {
    // Instagram oEmbed requires Meta app setup + token; keep as fallback for now.
    return null;
  }

  return null;
}

async function detectYouTubeContentKindViaOEmbed(
  videoId: string,
): Promise<"VIDEO" | "SHORTS" | null> {
  const shortsUrl = `https://www.youtube.com/shorts/${videoId}`;
  const oEmbedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(shortsUrl)}`;
  const response = await fetchWithTimeout(oEmbedUrl, {}, OEMBED_FETCH_TIMEOUT_MS);
  if (!response?.ok) return null;

  const payload = (await response.json()) as {
    width?: unknown;
    height?: unknown;
    thumbnail_url?: unknown;
  };
  const width =
    typeof payload.width === "number"
      ? payload.width
      : typeof payload.width === "string"
        ? Number(payload.width)
        : NaN;
  const height =
    typeof payload.height === "number"
      ? payload.height
      : typeof payload.height === "string"
        ? Number(payload.height)
        : NaN;
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return height > width ? "SHORTS" : "VIDEO";
  }

  if (typeof payload.thumbnail_url === "string" && payload.thumbnail_url.includes("/hq2")) {
    return "SHORTS";
  }

  return null;
}

export async function resolveSourcePreview(
  inputUrl: string,
  parentHostname?: string | null,
  options?: ResolveSourcePreviewOptions,
): Promise<SourcePreviewResolution> {
  const parsed = parseAnyItemSource(inputUrl);
  if (!parsed) {
    throw new Error("Invalid source URL");
  }

  const now = Date.now();
  const normalizedParent = normalizeParentHostname(parentHostname ?? null);
  const detectYouTubeContentKind = !!options?.detectYouTubeContentKind;
  const cacheKey = getCacheKey(parsed.normalizedUrl, normalizedParent, detectYouTubeContentKind);
  const cached = getCachedValue(cacheKey, now);
  if (cached) return cached;

  if (parsed.provider === "YOUTUBE" || parsed.provider === "SPOTIFY") {
    let youtubeContentKind: "VIDEO" | "SHORTS" | null = null;
    if (parsed.provider === "YOUTUBE") {
      youtubeContentKind = parsed.youtubeContentKind;
      if (
        detectYouTubeContentKind &&
        parsed.youtubeVideoId &&
        parsed.youtubeContentKind !== "SHORTS"
      ) {
        const detectedKind = await detectYouTubeContentKindViaOEmbed(parsed.youtubeVideoId);
        if (detectedKind === "SHORTS") {
          youtubeContentKind = "SHORTS";
        }
      }
    }

    const directProviderResult: SourcePreviewResolution = {
      sourceUrl: parsed.normalizedUrl,
      provider: parsed.provider,
      youtubeContentKind,
      kind: null,
      label: parsed.provider === "YOUTUBE" ? "YouTube" : "Spotify",
      embedUrl: parsed.embedUrl,
      embedType: parsed.embedUrl ? "iframe" : null,
      note: null,
      resolvedBy: parsed.embedUrl ? "native" : "none",
    };
    setCachedValue(cacheKey, directProviderResult, now);
    return directProviderResult;
  }

  const kind = detectExternalSourceKind(parsed.normalizedUrl);
  const capability = getExternalSourceCapability(kind);
  const label = capability?.label ?? "External link";
  const embedType = getEmbedTypeForKind(kind);
  let embedUrl = buildExternalSourceEmbedUrl(parsed.normalizedUrl, normalizedParent);
  let resolvedBy: SourcePreviewResolution["resolvedBy"] = embedUrl ? "native" : "none";

  if (!embedUrl && capability?.resolver && kind) {
    const host = new URL(parsed.normalizedUrl).hostname.toLowerCase();
    if (isResolverHostAllowed(capability.resolver, host)) {
      try {
        embedUrl = await resolveEmbedUrlViaOEmbed(capability.resolver, parsed.normalizedUrl);
        if (embedUrl) {
          resolvedBy = "resolver";
        }
      } catch {
        // Keep fallback behavior; this should never block source saving.
      }
    }
  }

  const note = embedUrl
    ? null
    : (capability?.fallbackNote ?? "No inline preview for this link type yet.");
  const result: SourcePreviewResolution = {
    sourceUrl: parsed.normalizedUrl,
    provider: null,
    youtubeContentKind: null,
    kind,
    label,
    embedUrl: embedUrl ?? null,
    embedType: embedUrl ? embedType : null,
    note,
    resolvedBy,
  };

  setCachedValue(cacheKey, result, now);

  return result;
}

export function __clearSourcePreviewResolverCacheForTests() {
  previewCache.clear();
}

export function __getSourcePreviewResolverCacheSizeForTests() {
  return previewCache.size;
}
