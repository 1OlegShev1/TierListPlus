import {
  buildExternalSourceEmbedUrl,
  detectExternalSourceKind,
  type ExternalSourceKind,
  type ExternalSourceResolver,
  getExternalSourceCapability,
  type ItemSourceProvider,
  MAX_ITEM_LABEL_LENGTH,
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
  thumbnailUrl: string | null;
  title: string | null;
  note: string | null;
  resolvedBy: "native" | "resolver" | "none";
}

interface OEmbedMetadata {
  thumbnailUrl: string | null;
  title: string | null;
}

interface ResolverPreviewResolution extends OEmbedMetadata {
  embedUrl: string | null;
  canonicalSourceUrl: string | null;
}

interface YouTubeOEmbedMetadata extends OEmbedMetadata {
  contentKind: "VIDEO" | "SHORTS" | null;
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

function normalizeMetadataTitle(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, MAX_ITEM_LABEL_LENGTH) : null;
}

function normalizeMetadataUrl(input: unknown): string | null {
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

function parseOEmbedMetadata(payload: {
  title?: unknown;
  thumbnail_url?: unknown;
}): OEmbedMetadata {
  return {
    title: normalizeMetadataTitle(payload.title),
    thumbnailUrl: normalizeMetadataUrl(payload.thumbnail_url),
  };
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

function extractMetaTagContent(html: string, key: string): string | null {
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

function stripHtmlTags(input: string): string {
  return decodeHtmlMetaValue(input)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
): Promise<ResolverPreviewResolution> {
  if (resolver === "SOUNDCLOUD_OEMBED") {
    const url = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(sourceUrl)}`;
    const response = await fetchWithTimeout(url, {}, OEMBED_FETCH_TIMEOUT_MS);
    if (!response?.ok) {
      return { embedUrl: null, thumbnailUrl: null, title: null, canonicalSourceUrl: null };
    }
    const payload = (await response.json()) as {
      html?: unknown;
      title?: unknown;
      thumbnail_url?: unknown;
    };
    if (typeof payload.html !== "string") {
      return { embedUrl: null, ...parseOEmbedMetadata(payload), canonicalSourceUrl: null };
    }
    const match = payload.html.match(/src="([^"]+)"/i);
    const embedUrl = match?.[1] && isSafeResolvedEmbedUrl(resolver, match[1]) ? match[1] : null;
    return { embedUrl, ...parseOEmbedMetadata(payload), canonicalSourceUrl: null };
  }

  if (resolver === "TIKTOK_OEMBED") {
    const finalUrl = await resolveTrustedRedirectTarget(resolver, sourceUrl);
    if (!finalUrl) {
      return { embedUrl: null, thumbnailUrl: null, title: null, canonicalSourceUrl: null };
    }
    const metadata = await resolveTikTokMetadataViaOEmbed(finalUrl);
    return {
      embedUrl: buildExternalSourceEmbedUrl(finalUrl, null),
      thumbnailUrl: metadata.thumbnailUrl,
      title: metadata.title,
      canonicalSourceUrl: finalUrl,
    };
  }

  if (resolver === "X_OEMBED") {
    // X oEmbed is also script/widget driven; no iframe URL is returned.
    return { embedUrl: null, thumbnailUrl: null, title: null, canonicalSourceUrl: null };
  }

  if (resolver === "INSTAGRAM_OEMBED") {
    // Instagram oEmbed requires Meta app setup + token; keep as fallback for now.
    return { embedUrl: null, thumbnailUrl: null, title: null, canonicalSourceUrl: null };
  }

  return { embedUrl: null, thumbnailUrl: null, title: null, canonicalSourceUrl: null };
}

async function detectYouTubeContentKindViaOEmbed(videoId: string): Promise<YouTubeOEmbedMetadata> {
  const shortsUrl = `https://www.youtube.com/shorts/${videoId}`;
  const oEmbedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(shortsUrl)}`;
  const response = await fetchWithTimeout(oEmbedUrl, {}, OEMBED_FETCH_TIMEOUT_MS);
  if (!response?.ok) {
    return { contentKind: null, thumbnailUrl: null, title: null };
  }

  const payload = (await response.json()) as {
    width?: unknown;
    height?: unknown;
    thumbnail_url?: unknown;
    title?: unknown;
  };
  const metadata = parseOEmbedMetadata(payload);
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
    return {
      contentKind: height > width ? "SHORTS" : "VIDEO",
      thumbnailUrl: metadata.thumbnailUrl,
      title: metadata.title,
    };
  }

  if (typeof payload.thumbnail_url === "string" && payload.thumbnail_url.includes("/hq2")) {
    return { contentKind: "SHORTS", thumbnailUrl: metadata.thumbnailUrl, title: metadata.title };
  }

  return { contentKind: null, thumbnailUrl: metadata.thumbnailUrl, title: metadata.title };
}

async function resolveSpotifyMetadataViaOEmbed(sourceUrl: string): Promise<OEmbedMetadata> {
  const oEmbedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(sourceUrl)}`;
  const response = await fetchWithTimeout(oEmbedUrl, {}, OEMBED_FETCH_TIMEOUT_MS);
  if (!response?.ok) {
    return { thumbnailUrl: null, title: null };
  }
  const payload = (await response.json()) as {
    title?: unknown;
    thumbnail_url?: unknown;
  };
  return parseOEmbedMetadata(payload);
}

async function resolveVimeoMetadataViaOEmbed(sourceUrl: string): Promise<OEmbedMetadata> {
  const oEmbedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(sourceUrl)}`;
  const response = await fetchWithTimeout(oEmbedUrl, {}, OEMBED_FETCH_TIMEOUT_MS);
  if (!response?.ok) {
    return { thumbnailUrl: null, title: null };
  }
  const payload = (await response.json()) as {
    title?: unknown;
    thumbnail_url?: unknown;
  };
  return parseOEmbedMetadata(payload);
}

async function resolveTikTokMetadataViaOEmbed(sourceUrl: string): Promise<OEmbedMetadata> {
  const oEmbedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(sourceUrl)}`;
  const response = await fetchWithTimeout(oEmbedUrl, {}, OEMBED_FETCH_TIMEOUT_MS);
  if (!response?.ok) {
    return { thumbnailUrl: null, title: null };
  }
  const payload = (await response.json()) as {
    title?: unknown;
    thumbnail_url?: unknown;
  };
  return parseOEmbedMetadata(payload);
}

async function resolveInstagramMetadataViaHtml(sourceUrl: string): Promise<OEmbedMetadata> {
  const response = await fetchWithTimeout(sourceUrl, {}, OEMBED_FETCH_TIMEOUT_MS);
  if (!response?.ok) {
    return { thumbnailUrl: null, title: null };
  }

  const html = (await response.text()).slice(0, 200_000);
  const title = normalizeMetadataTitle(
    extractMetaTagContent(html, "og:title") ?? extractMetaTagContent(html, "twitter:title"),
  );
  const thumbnailUrl = normalizeMetadataUrl(
    extractMetaTagContent(html, "og:image") ?? extractMetaTagContent(html, "twitter:image"),
  );
  return { thumbnailUrl, title };
}

function normalizeXUrlForOEmbed(sourceUrl: string): string {
  try {
    const parsed = new URL(sourceUrl);
    const host = parsed.hostname.toLowerCase();
    if (host === "x.com" || host === "www.x.com") {
      parsed.hostname = "twitter.com";
    }
    return parsed.toString();
  } catch {
    return sourceUrl;
  }
}

async function resolveXMetadataViaOEmbed(sourceUrl: string): Promise<OEmbedMetadata> {
  const normalizedUrl = normalizeXUrlForOEmbed(sourceUrl);
  const oEmbedUrl = `https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(normalizedUrl)}`;
  const response = await fetchWithTimeout(oEmbedUrl, {}, OEMBED_FETCH_TIMEOUT_MS);
  if (!response?.ok) {
    return { thumbnailUrl: null, title: null };
  }

  const payload = (await response.json()) as {
    html?: unknown;
    author_name?: unknown;
  };
  const authorName = normalizeMetadataTitle(payload.author_name);
  const body =
    typeof payload.html === "string"
      ? (payload.html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? payload.html)
      : "";
  const title = normalizeMetadataTitle(stripHtmlTags(body)) ?? authorName;
  return { thumbnailUrl: null, title };
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
    let thumbnailUrl = parsed.thumbnailUrl;
    let title: string | null = null;
    if (parsed.provider === "YOUTUBE") {
      youtubeContentKind = parsed.youtubeContentKind;
      if (detectYouTubeContentKind && parsed.youtubeVideoId) {
        const metadata = await detectYouTubeContentKindViaOEmbed(parsed.youtubeVideoId);
        if (metadata.contentKind === "SHORTS") {
          youtubeContentKind = "SHORTS";
        }
        thumbnailUrl = metadata.thumbnailUrl ?? thumbnailUrl;
        title = metadata.title;
      }
    }
    if (parsed.provider === "SPOTIFY") {
      const metadata = await resolveSpotifyMetadataViaOEmbed(parsed.normalizedUrl);
      thumbnailUrl = metadata.thumbnailUrl ?? thumbnailUrl;
      title = metadata.title;
    }

    const directProviderResult: SourcePreviewResolution = {
      sourceUrl: parsed.normalizedUrl,
      provider: parsed.provider,
      youtubeContentKind,
      kind: null,
      label: parsed.provider === "YOUTUBE" ? "YouTube" : "Spotify",
      embedUrl: parsed.embedUrl,
      embedType: parsed.embedUrl ? "iframe" : null,
      thumbnailUrl,
      title,
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
  let thumbnailUrl: string | null = kind === "IMAGE" ? parsed.normalizedUrl : null;
  let title: string | null = null;
  let canonicalSourceUrl = parsed.normalizedUrl;
  let attemptedResolverMetadata = false;

  if (!embedUrl && capability?.resolver && kind) {
    const host = new URL(parsed.normalizedUrl).hostname.toLowerCase();
    if (isResolverHostAllowed(capability.resolver, host)) {
      attemptedResolverMetadata = true;
      try {
        const resolvedPreview = await resolveEmbedUrlViaOEmbed(
          capability.resolver,
          parsed.normalizedUrl,
        );
        embedUrl = resolvedPreview.embedUrl;
        thumbnailUrl = resolvedPreview.thumbnailUrl ?? thumbnailUrl;
        title = resolvedPreview.title;
        canonicalSourceUrl = resolvedPreview.canonicalSourceUrl ?? canonicalSourceUrl;
        if (resolvedPreview.embedUrl) {
          resolvedBy = "resolver";
        }
      } catch {
        // Keep fallback behavior; this should never block source saving.
      }
    }
  }

  if (kind === "VIMEO") {
    try {
      const metadata = await resolveVimeoMetadataViaOEmbed(canonicalSourceUrl);
      thumbnailUrl = metadata.thumbnailUrl ?? thumbnailUrl;
      title = metadata.title ?? title;
    } catch {
      // Keep fallback behavior; source save should never fail on metadata fetch.
    }
  } else if (kind === "SOUNDCLOUD" && !attemptedResolverMetadata && !thumbnailUrl && !title) {
    try {
      const metadata = await resolveEmbedUrlViaOEmbed("SOUNDCLOUD_OEMBED", canonicalSourceUrl);
      if (!embedUrl && metadata.embedUrl) {
        embedUrl = metadata.embedUrl;
        resolvedBy = "resolver";
      }
      thumbnailUrl = metadata.thumbnailUrl ?? thumbnailUrl;
      title = metadata.title ?? title;
    } catch {
      // Keep fallback behavior; source save should never fail on metadata fetch.
    }
  } else if (kind === "TIKTOK" && !thumbnailUrl && !title) {
    try {
      const metadata = await resolveTikTokMetadataViaOEmbed(canonicalSourceUrl);
      thumbnailUrl = metadata.thumbnailUrl ?? thumbnailUrl;
      title = metadata.title ?? title;
    } catch {
      // Keep fallback behavior; source save should never fail on metadata fetch.
    }
  } else if (kind === "INSTAGRAM" && !thumbnailUrl && !title) {
    try {
      const metadata = await resolveInstagramMetadataViaHtml(canonicalSourceUrl);
      thumbnailUrl = metadata.thumbnailUrl ?? thumbnailUrl;
      title = metadata.title ?? title;
    } catch {
      // Keep fallback behavior; source save should never fail on metadata fetch.
    }
  } else if (kind === "X" && !title) {
    try {
      const metadata = await resolveXMetadataViaOEmbed(canonicalSourceUrl);
      title = metadata.title ?? title;
    } catch {
      // Keep fallback behavior; source save should never fail on metadata fetch.
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
    thumbnailUrl,
    title,
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
