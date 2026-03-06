export type ItemSourceProvider = "SPOTIFY" | "YOUTUBE";

export interface ParsedItemSource {
  provider: ItemSourceProvider;
  normalizedUrl: string;
  embedUrl: string;
  thumbnailUrl: string | null;
  youtubeVideoId: string | null;
}

const SUPPORTED_YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const SUPPORTED_SPOTIFY_HOSTS = new Set(["open.spotify.com", "play.spotify.com"]);

const SUPPORTED_SPOTIFY_RESOURCE_TYPES = new Set([
  "track",
  "album",
  "artist",
  "playlist",
  "episode",
  "show",
]);

const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_RESOURCE_ID_RE = /^[A-Za-z0-9]{22}$/;
export const MAX_SOURCE_INTERVAL_SECONDS = 2_147_483_647;

function getYouTubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (!SUPPORTED_YOUTUBE_HOSTS.has(host)) return null;

  if (host === "youtu.be" || host === "www.youtu.be") {
    const [candidate] = url.pathname.split("/").filter(Boolean);
    return candidate && YOUTUBE_VIDEO_ID_RE.test(candidate) ? candidate : null;
  }

  if (url.pathname === "/watch") {
    const candidate = url.searchParams.get("v");
    return candidate && YOUTUBE_VIDEO_ID_RE.test(candidate) ? candidate : null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const [prefix, candidate] = segments;
  if (!["embed", "shorts", "live"].includes(prefix)) return null;

  return YOUTUBE_VIDEO_ID_RE.test(candidate) ? candidate : null;
}

function parseYouTubeSource(url: URL): ParsedItemSource | null {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;

  return {
    provider: "YOUTUBE",
    normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    youtubeVideoId: videoId,
  };
}

function parseSpotifySource(url: URL): ParsedItemSource | null {
  const host = url.hostname.toLowerCase();
  if (!SUPPORTED_SPOTIFY_HOSTS.has(host)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const [resourceType, resourceId] = segments;
  if (!SUPPORTED_SPOTIFY_RESOURCE_TYPES.has(resourceType)) return null;
  if (!SPOTIFY_RESOURCE_ID_RE.test(resourceId)) return null;

  return {
    provider: "SPOTIFY",
    normalizedUrl: `https://open.spotify.com/${resourceType}/${resourceId}`,
    embedUrl: `https://open.spotify.com/embed/${resourceType}/${resourceId}`,
    thumbnailUrl: null,
    youtubeVideoId: null,
  };
}

export function parseSupportedItemSource(inputUrl: string): ParsedItemSource | null {
  const trimmed = inputUrl.trim();
  if (!trimmed) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return null;
  }

  return parseYouTubeSource(parsedUrl) ?? parseSpotifySource(parsedUrl);
}

export const UNSUPPORTED_ITEM_SOURCE_MESSAGE =
  "Only Spotify and YouTube links are supported right now.";

export function resolveItemSourceForWrite(sourceUrl: string | null | undefined): {
  sourceUrl?: string | null;
  sourceProvider?: ItemSourceProvider | null;
} {
  if (sourceUrl === undefined) return {};
  if (sourceUrl === null) {
    return { sourceUrl: null, sourceProvider: null };
  }

  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return { sourceUrl: null, sourceProvider: null };
  }

  const parsed = parseSupportedItemSource(trimmed);
  if (!parsed) {
    throw new Error(UNSUPPORTED_ITEM_SOURCE_MESSAGE);
  }

  return {
    sourceUrl: parsed.normalizedUrl,
    sourceProvider: parsed.provider,
  };
}

export function normalizeItemSourceNote(
  sourceNote: string | null | undefined,
): string | null | undefined {
  if (sourceNote === undefined) return undefined;
  if (sourceNote === null) return null;
  const trimmed = sourceNote.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeIntervalValue(value: number | null | undefined): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
}

export function resolveSourceIntervalForWrite(
  sourceProvider: ItemSourceProvider | null | undefined,
  sourceStartSec: number | null | undefined,
  sourceEndSec: number | null | undefined,
): { sourceStartSec?: number | null; sourceEndSec?: number | null } {
  const startProvided = sourceStartSec !== undefined;
  const endProvided = sourceEndSec !== undefined;
  const start = normalizeIntervalValue(sourceStartSec);
  const end = normalizeIntervalValue(sourceEndSec);

  if (
    (typeof start === "number" && start > MAX_SOURCE_INTERVAL_SECONDS) ||
    (typeof end === "number" && end > MAX_SOURCE_INTERVAL_SECONDS)
  ) {
    throw new Error(`Time must be less than or equal to ${MAX_SOURCE_INTERVAL_SECONDS} seconds.`);
  }

  if (sourceProvider !== "YOUTUBE") {
    if ((startProvided && typeof start === "number") || (endProvided && typeof end === "number")) {
      throw new Error("Source intervals are only supported for YouTube links.");
    }
    return {
      sourceStartSec: startProvided ? null : undefined,
      sourceEndSec: endProvided ? null : undefined,
    };
  }

  const hasStart = typeof start === "number";
  const hasEnd = typeof end === "number";
  if (hasStart && hasEnd && end <= start) {
    throw new Error("End time must be greater than start time.");
  }

  return {
    ...(start !== undefined ? { sourceStartSec: start } : {}),
    ...(end !== undefined ? { sourceEndSec: end } : {}),
  };
}

export function buildYouTubeEmbedUrl(
  videoId: string,
  sourceStartSec: number | null | undefined,
  sourceEndSec: number | null | undefined,
) {
  const params = new URLSearchParams();
  if (typeof sourceStartSec === "number" && sourceStartSec >= 0) {
    params.set("start", String(Math.floor(sourceStartSec)));
  }
  if (typeof sourceEndSec === "number" && sourceEndSec >= 0) {
    params.set("end", String(Math.floor(sourceEndSec)));
  }
  const query = params.toString();
  return `https://www.youtube.com/embed/${videoId}${query ? `?${query}` : ""}`;
}

export function getItemSourceProviderLabel(provider: ItemSourceProvider): string {
  switch (provider) {
    case "SPOTIFY":
      return "Spotify";
    case "YOUTUBE":
      return "YouTube";
    default:
      return "Link";
  }
}
