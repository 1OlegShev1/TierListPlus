import { PREVIEW_CACHE_MAX_ENTRIES, PREVIEW_CACHE_TTL_MS } from "@/lib/source-preview/constants";
import type { SourcePreviewResolution } from "@/lib/source-preview/types";

interface CacheEntry {
  expiresAt: number;
  value: SourcePreviewResolution;
}

const previewCache = new Map<string, CacheEntry>();

export function getPreviewCacheKey(
  sourceUrl: string,
  parentHostname: string | null,
  detectYouTubeContentKind: boolean,
  includeYouTubeDuration: boolean,
): string {
  return `${sourceUrl}::${parentHostname ?? ""}::ytkind:${detectYouTubeContentKind ? "1" : "0"}::ytdur:${includeYouTubeDuration ? "1" : "0"}`;
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

export function getCachedPreview(cacheKey: string, now: number): SourcePreviewResolution | null {
  const entry = previewCache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    previewCache.delete(cacheKey);
    return null;
  }

  previewCache.delete(cacheKey);
  previewCache.set(cacheKey, entry);
  return entry.value;
}

export function setCachedPreview(cacheKey: string, value: SourcePreviewResolution, now: number) {
  previewCache.set(cacheKey, {
    expiresAt: now + PREVIEW_CACHE_TTL_MS,
    value,
  });
  pruneCache(now);
}

export function clearSourcePreviewCacheForTests() {
  previewCache.clear();
}

export function getSourcePreviewCacheSizeForTests() {
  return previewCache.size;
}
