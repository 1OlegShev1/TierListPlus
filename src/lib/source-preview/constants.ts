import type { ExternalSourceResolver } from "@/lib/item-source";

export const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
export const PREVIEW_CACHE_MAX_ENTRIES = 500;
export const OEMBED_FETCH_TIMEOUT_MS = 4_000;
export const MAX_RESOLVER_REDIRECTS = 4;
export const MAX_HTML_PREVIEW_BYTES = 300_000;
export const BLOCKED_PREVIEW_NOTE =
  "Preview blocked for local or private network URLs. Use Open source.";

export const RESOLVER_HOST_ALLOWLIST: Record<ExternalSourceResolver, Set<string>> = {
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

export const RESOLVER_EMBED_HOST_ALLOWLIST: Record<ExternalSourceResolver, Set<string>> = {
  SOUNDCLOUD_OEMBED: new Set(["w.soundcloud.com"]),
  TIKTOK_OEMBED: new Set(),
  X_OEMBED: new Set(),
  INSTAGRAM_OEMBED: new Set(),
};
