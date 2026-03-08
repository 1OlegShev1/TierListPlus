export type ItemSourceProvider = "SPOTIFY" | "YOUTUBE";
export type ExternalSourceKind =
  | "VIMEO"
  | "SOUNDCLOUD"
  | "TWITCH"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "PDF"
  | "X"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "TIKTOK"
  | "GENERIC";
export type ExternalSourceResolver =
  | "SOUNDCLOUD_OEMBED"
  | "TIKTOK_OEMBED"
  | "X_OEMBED"
  | "INSTAGRAM_OEMBED";
export type ExternalSourcePreviewMode = "INLINE_EMBED" | "DIRECT_MEDIA" | "RESOLVER" | "NONE";

export interface ExternalSourceCapability {
  label: string;
  previewMode: ExternalSourcePreviewMode;
  resolver: ExternalSourceResolver | null;
  fallbackNote: string | null;
}

export interface ParsedItemSource {
  provider: ItemSourceProvider | null;
  normalizedUrl: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  youtubeVideoId: string | null;
  youtubeContentKind: "VIDEO" | "SHORTS" | null;
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
const SUPPORTED_VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);
const SUPPORTED_SOUNDCLOUD_HOSTS = new Set([
  "soundcloud.com",
  "www.soundcloud.com",
  "m.soundcloud.com",
  "on.soundcloud.com",
]);
const SUPPORTED_TWITCH_HOSTS = new Set([
  "twitch.tv",
  "www.twitch.tv",
  "m.twitch.tv",
  "clips.twitch.tv",
]);
const SUPPORTED_X_HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com"]);
const SUPPORTED_FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "fb.watch",
]);
const SUPPORTED_INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);
const SUPPORTED_TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "vm.tiktok.com"]);

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
const X_STATUS_ID_RE = /^\d{5,}$/;
const INSTAGRAM_MEDIA_CODE_RE = /^[A-Za-z0-9_-]{5,}$/;
const TIKTOK_VIDEO_ID_RE = /^\d{6,}$/;
const IMAGE_FILE_EXT_RE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;
const VIDEO_FILE_EXT_RE = /\.(m3u8|mp4|mov|ogv|webm)$/i;
const AUDIO_FILE_EXT_RE = /\.(aac|flac|m4a|mp3|ogg|wav)$/i;
const PDF_FILE_EXT_RE = /\.pdf$/i;
export const MAX_SOURCE_INTERVAL_SECONDS = 2_147_483_647;

const EXTERNAL_SOURCE_CAPABILITIES: Record<ExternalSourceKind, ExternalSourceCapability> = {
  VIMEO: {
    label: "Vimeo",
    previewMode: "INLINE_EMBED",
    resolver: null,
    fallbackNote: null,
  },
  SOUNDCLOUD: {
    label: "SoundCloud",
    previewMode: "RESOLVER",
    resolver: "SOUNDCLOUD_OEMBED",
    fallbackNote: "Loading SoundCloud preview... If it does not appear, use Open source.",
  },
  TWITCH: {
    label: "Twitch",
    previewMode: "INLINE_EMBED",
    resolver: null,
    fallbackNote:
      "Twitch preview needs a valid app hostname; use Open source if it does not render.",
  },
  IMAGE: {
    label: "Image",
    previewMode: "DIRECT_MEDIA",
    resolver: null,
    fallbackNote: null,
  },
  VIDEO: {
    label: "Video",
    previewMode: "DIRECT_MEDIA",
    resolver: null,
    fallbackNote: null,
  },
  AUDIO: {
    label: "Audio",
    previewMode: "DIRECT_MEDIA",
    resolver: null,
    fallbackNote: null,
  },
  PDF: {
    label: "PDF",
    previewMode: "NONE",
    resolver: null,
    fallbackNote: "PDF preview is often blocked by browser or site policy. Use Open source.",
  },
  X: {
    label: "X",
    previewMode: "INLINE_EMBED",
    resolver: null,
    fallbackNote: "X preview may be blocked by browser or site policy. Use Open source.",
  },
  FACEBOOK: {
    label: "Facebook",
    previewMode: "NONE",
    resolver: null,
    fallbackNote: "Facebook commonly blocks iframe preview here. Use Open source.",
  },
  INSTAGRAM: {
    label: "Instagram",
    previewMode: "INLINE_EMBED",
    resolver: null,
    fallbackNote: "Instagram preview may be blocked by browser or site policy. Use Open source.",
  },
  TIKTOK: {
    label: "TikTok",
    previewMode: "RESOLVER",
    resolver: "TIKTOK_OEMBED",
    fallbackNote: "TikTok preview may be blocked by browser or site policy. Use Open source.",
  },
  GENERIC: {
    label: "External link",
    previewMode: "NONE",
    resolver: null,
    fallbackNote: "No inline preview for this link type yet.",
  },
};

function parseHttpSourceUrl(inputUrl: string): URL | null {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(inputUrl);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return null;
  }

  if (parsedUrl.username || parsedUrl.password) {
    return null;
  }

  return parsedUrl;
}

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
  const segments = url.pathname.split("/").filter(Boolean);
  const isShortsSource = segments[0] === "shorts";

  return {
    provider: "YOUTUBE",
    normalizedUrl: isShortsSource
      ? `https://www.youtube.com/shorts/${videoId}`
      : `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    youtubeVideoId: videoId,
    youtubeContentKind: isShortsSource ? "SHORTS" : "VIDEO",
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
    youtubeContentKind: null,
  };
}

export function parseSupportedItemSource(inputUrl: string): ParsedItemSource | null {
  const trimmed = inputUrl.trim();
  if (!trimmed) return null;

  const parsedUrl = parseHttpSourceUrl(trimmed);
  if (!parsedUrl) return null;

  return parseYouTubeSource(parsedUrl) ?? parseSpotifySource(parsedUrl);
}

function getVimeoVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (!SUPPORTED_VIMEO_HOSTS.has(host)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  if (host === "player.vimeo.com") {
    if (segments[0] !== "video" || !/^\d+$/.test(segments[1] ?? "")) return null;
    return segments[1] ?? null;
  }

  const numericSegment = [...segments].reverse().find((segment) => /^\d+$/.test(segment));
  return numericSegment ?? null;
}

function buildSoundCloudEmbedUrl(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (!SUPPORTED_SOUNDCLOUD_HOSTS.has(host)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const normalizedUrl = `https://soundcloud.com${url.pathname.replace(/\/$/, "")}`;
  const encoded = encodeURIComponent(normalizedUrl);
  return `https://w.soundcloud.com/player/?url=${encoded}&color=%23f59e0b&auto_play=false&hide_related=false&show_comments=false&show_user=true&show_reposts=false&show_teaser=true`;
}

function buildTwitchEmbedUrl(url: URL, parentHostname: string): string | null {
  if (!parentHostname) return null;

  const host = url.hostname.toLowerCase();
  if (!SUPPORTED_TWITCH_HOSTS.has(host)) return null;

  const encodedParent = encodeURIComponent(parentHostname);
  if (host === "clips.twitch.tv") {
    const clipSlug = url.pathname.split("/").filter(Boolean)[0];
    if (!clipSlug) return null;
    return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clipSlug)}&parent=${encodedParent}`;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] === "clip" && segments[1]) {
    return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(segments[1])}&parent=${encodedParent}`;
  }
  if (segments[1] === "clip" && segments[2]) {
    return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(segments[2])}&parent=${encodedParent}`;
  }
  if (segments[0] === "videos" && segments[1] && /^\d+$/.test(segments[1])) {
    return `https://player.twitch.tv/?video=v${segments[1]}&parent=${encodedParent}`;
  }

  const channelName = segments[0];
  if (!channelName) return null;
  return `https://player.twitch.tv/?channel=${encodeURIComponent(channelName)}&parent=${encodedParent}`;
}

function getXStatusId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (!SUPPORTED_X_HOSTS.has(host)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  const statusIndex = segments.indexOf("status");
  if (statusIndex < 0) return null;
  const candidate = segments[statusIndex + 1];
  return candidate && X_STATUS_ID_RE.test(candidate) ? candidate : null;
}

function getInstagramMedia(url: URL): { type: "p" | "reel" | "tv"; code: string } | null {
  const host = url.hostname.toLowerCase();
  if (!SUPPORTED_INSTAGRAM_HOSTS.has(host)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const [rawType, code] = segments;
  const type =
    rawType === "p"
      ? "p"
      : rawType === "reel" || rawType === "reels"
        ? "reel"
        : rawType === "tv"
          ? "tv"
          : null;
  if (!type || !INSTAGRAM_MEDIA_CODE_RE.test(code ?? "")) return null;

  return { type, code };
}

function getTikTokVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (!SUPPORTED_TIKTOK_HOSTS.has(host) || host === "vm.tiktok.com") return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 3 || !segments[0]?.startsWith("@")) return null;
  if (segments[1] !== "video") return null;

  const videoId = segments[2];
  return videoId && TIKTOK_VIDEO_ID_RE.test(videoId) ? videoId : null;
}

export function parseAnyItemSource(inputUrl: string): ParsedItemSource | null {
  const trimmed = inputUrl.trim();
  if (!trimmed) return null;

  const parsedUrl = parseHttpSourceUrl(trimmed);
  if (!parsedUrl) return null;

  const supported = parseYouTubeSource(parsedUrl) ?? parseSpotifySource(parsedUrl);
  if (supported) return supported;

  return {
    provider: null,
    normalizedUrl: parsedUrl.toString(),
    embedUrl: null,
    thumbnailUrl: null,
    youtubeVideoId: null,
    youtubeContentKind: null,
  };
}

export function detectExternalSourceKind(
  sourceUrl: string | null | undefined,
): ExternalSourceKind | null {
  if (!sourceUrl) return null;

  const parsedUrl = parseHttpSourceUrl(sourceUrl.trim());
  if (!parsedUrl) return null;

  const host = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();
  if (SUPPORTED_VIMEO_HOSTS.has(host)) return "VIMEO";
  if (SUPPORTED_SOUNDCLOUD_HOSTS.has(host)) return "SOUNDCLOUD";
  if (SUPPORTED_TWITCH_HOSTS.has(host)) return "TWITCH";
  if (IMAGE_FILE_EXT_RE.test(pathname)) return "IMAGE";
  if (VIDEO_FILE_EXT_RE.test(pathname)) return "VIDEO";
  if (AUDIO_FILE_EXT_RE.test(pathname)) return "AUDIO";
  if (PDF_FILE_EXT_RE.test(pathname)) return "PDF";
  if (SUPPORTED_X_HOSTS.has(host)) return "X";
  if (SUPPORTED_FACEBOOK_HOSTS.has(host)) return "FACEBOOK";
  if (SUPPORTED_INSTAGRAM_HOSTS.has(host)) return "INSTAGRAM";
  if (SUPPORTED_TIKTOK_HOSTS.has(host)) return "TIKTOK";
  return "GENERIC";
}

export function buildExternalSourceEmbedUrl(
  sourceUrl: string | null | undefined,
  parentHostname?: string | null,
): string | null {
  if (!sourceUrl) return null;

  const parsedUrl = parseHttpSourceUrl(sourceUrl.trim());
  if (!parsedUrl) return null;

  const kind = detectExternalSourceKind(parsedUrl.toString());
  if (kind === "VIMEO") {
    const videoId = getVimeoVideoId(parsedUrl);
    return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
  }
  if (kind === "SOUNDCLOUD") {
    return buildSoundCloudEmbedUrl(parsedUrl);
  }
  if (kind === "TWITCH") {
    return buildTwitchEmbedUrl(parsedUrl, parentHostname?.trim() ?? "");
  }
  if (kind === "X") {
    const statusId = getXStatusId(parsedUrl);
    return statusId
      ? `https://platform.twitter.com/embed/Tweet.html?id=${encodeURIComponent(statusId)}&dnt=true`
      : null;
  }
  if (kind === "INSTAGRAM") {
    const media = getInstagramMedia(parsedUrl);
    if (!media) return null;
    const base = `https://www.instagram.com/${media.type}/${media.code}/embed`;
    return media.type === "reel" ? `${base}?autoplay=1` : base;
  }
  if (kind === "TIKTOK") {
    const videoId = getTikTokVideoId(parsedUrl);
    return videoId
      ? `https://www.tiktok.com/player/v1/${encodeURIComponent(videoId)}?autoplay=1&loop=1&description=0&music_info=0&rel=0`
      : null;
  }
  if (kind === "IMAGE" || kind === "VIDEO" || kind === "AUDIO") {
    return parsedUrl.toString();
  }
  return null;
}

export function getExternalSourceCapability(
  kind: ExternalSourceKind | null | undefined,
): ExternalSourceCapability | null {
  if (!kind) return null;
  return EXTERNAL_SOURCE_CAPABILITIES[kind];
}

export function getExternalSourceKindLabel(kind: ExternalSourceKind | null): string | null {
  return getExternalSourceCapability(kind)?.label ?? null;
}

export const INVALID_ITEM_SOURCE_MESSAGE = "Enter a valid http(s) URL.";

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

  const parsed = parseAnyItemSource(trimmed);
  if (!parsed) {
    throw new Error(INVALID_ITEM_SOURCE_MESSAGE);
  }

  return {
    sourceUrl: parsed.normalizedUrl,
    sourceProvider: parsed.provider ?? null,
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
  youtubeContentKind: "VIDEO" | "SHORTS" | null = null,
) {
  const params = new URLSearchParams();
  if (youtubeContentKind === "SHORTS") {
    params.set("autoplay", "1");
    params.set("mute", "1");
    params.set("loop", "1");
    params.set("playlist", videoId);
    params.set("playsinline", "1");
  }
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
