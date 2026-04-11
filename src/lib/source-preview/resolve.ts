import {
  detectExternalSourceKind,
  getExternalSourceCapability,
  type ParsedItemSource,
  parseAnyItemSource,
} from "@/lib/item-source";
import {
  clearSourcePreviewCacheForTests,
  getCachedPreview,
  getPreviewCacheKey,
  getSourcePreviewCacheSizeForTests,
  setCachedPreview,
} from "@/lib/source-preview/cache";
import { BLOCKED_PREVIEW_NOTE } from "@/lib/source-preview/constants";
import { isSourcePreviewBlockedError, SourcePreviewBlockedError } from "@/lib/source-preview/http";
import { resolveExternalSourcePreview } from "@/lib/source-preview/providers/external";
import { resolveSpotifyMetadataViaOEmbed } from "@/lib/source-preview/providers/spotify";
import { resolveYouTubePreview } from "@/lib/source-preview/providers/youtube";
import { getBlockedUrlReason, normalizeParentHostname } from "@/lib/source-preview/security";
import type {
  ResolveSourcePreviewOptions,
  SourcePreviewResolution,
} from "@/lib/source-preview/types";

function buildBlockedPreviewResolution(sourceUrl: string): SourcePreviewResolution {
  const kind = detectExternalSourceKind(sourceUrl);
  const capability = getExternalSourceCapability(kind);
  return {
    sourceUrl,
    provider: null,
    youtubeContentKind: null,
    durationSec: null,
    kind,
    label: capability?.label ?? "External link",
    embedUrl: null,
    embedType: null,
    thumbnailUrl: null,
    title: null,
    description: null,
    siteName: null,
    note: BLOCKED_PREVIEW_NOTE,
    resolvedBy: "none",
  };
}

function buildYouTubeResolution(
  parsed: ParsedItemSource,
  metadata: {
    youtubeContentKind: "VIDEO" | "SHORTS" | null;
    thumbnailUrl: string | null;
    title: string | null;
    durationSec: number | null;
  },
): SourcePreviewResolution {
  return {
    sourceUrl: parsed.normalizedUrl,
    provider: "YOUTUBE",
    youtubeContentKind: metadata.youtubeContentKind,
    durationSec: metadata.durationSec,
    kind: null,
    label: "YouTube",
    embedUrl: parsed.embedUrl,
    embedType: parsed.embedUrl ? "iframe" : null,
    thumbnailUrl: metadata.thumbnailUrl,
    title: metadata.title,
    description: null,
    siteName: null,
    note: null,
    resolvedBy: parsed.embedUrl ? "native" : "none",
  };
}

function buildSpotifyResolution(
  parsed: ParsedItemSource,
  metadata: {
    thumbnailUrl: string | null;
    title: string | null;
    durationSec: number | null;
  },
): SourcePreviewResolution {
  return {
    sourceUrl: parsed.normalizedUrl,
    provider: "SPOTIFY",
    youtubeContentKind: null,
    durationSec: metadata.durationSec,
    kind: null,
    label: "Spotify",
    embedUrl: parsed.embedUrl,
    embedType: parsed.embedUrl ? "iframe" : null,
    thumbnailUrl: metadata.thumbnailUrl ?? parsed.thumbnailUrl,
    title: metadata.title,
    description: null,
    siteName: null,
    note: null,
    resolvedBy: parsed.embedUrl ? "native" : "none",
  };
}

function buildExternalResolution(
  sourceUrl: string,
  external: {
    kind: SourcePreviewResolution["kind"];
    label: string;
    embedUrl: SourcePreviewResolution["embedUrl"];
    embedType: SourcePreviewResolution["embedType"];
    thumbnailUrl: SourcePreviewResolution["thumbnailUrl"];
    title: SourcePreviewResolution["title"];
    description: SourcePreviewResolution["description"];
    siteName: SourcePreviewResolution["siteName"];
    durationSec: SourcePreviewResolution["durationSec"];
    note: SourcePreviewResolution["note"];
    resolvedBy: SourcePreviewResolution["resolvedBy"];
  },
): SourcePreviewResolution {
  return {
    sourceUrl,
    provider: null,
    youtubeContentKind: null,
    durationSec: external.durationSec,
    kind: external.kind,
    label: external.label,
    embedUrl: external.embedUrl,
    embedType: external.embedType,
    thumbnailUrl: external.thumbnailUrl,
    title: external.title,
    description: external.description,
    siteName: external.siteName,
    note: external.note,
    resolvedBy: external.resolvedBy,
  };
}

function isBlockedPreviewError(error: unknown): boolean {
  return error instanceof SourcePreviewBlockedError || isSourcePreviewBlockedError(error);
}

async function resolveProviderPreview(
  parsed: ParsedItemSource,
  normalizedParent: string | null,
  options: ResolveSourcePreviewOptions | undefined,
): Promise<SourcePreviewResolution> {
  const detectYouTubeContentKind = !!options?.detectYouTubeContentKind;
  const includeYouTubeDuration = !!options?.includeYouTubeDuration;

  if (parsed.provider === "YOUTUBE") {
    const metadata = await resolveYouTubePreview(parsed, {
      detectYouTubeContentKind,
      includeYouTubeDuration,
    });
    return buildYouTubeResolution(parsed, metadata);
  }

  if (parsed.provider === "SPOTIFY") {
    const metadata = await resolveSpotifyMetadataViaOEmbed(parsed.normalizedUrl);
    return buildSpotifyResolution(parsed, metadata);
  }

  const external = await resolveExternalSourcePreview(parsed.normalizedUrl, normalizedParent);
  return buildExternalResolution(parsed.normalizedUrl, external);
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
  const includeYouTubeDuration = !!options?.includeYouTubeDuration;
  const cacheKey = getPreviewCacheKey(
    parsed.normalizedUrl,
    normalizedParent,
    detectYouTubeContentKind,
    includeYouTubeDuration,
  );
  const cached = getCachedPreview(cacheKey, now);
  if (cached) return cached;

  if (getBlockedUrlReason(parsed.normalizedUrl)) {
    const blocked = buildBlockedPreviewResolution(parsed.normalizedUrl);
    setCachedPreview(cacheKey, blocked, now);
    return blocked;
  }

  try {
    const result = await resolveProviderPreview(parsed, normalizedParent, options);
    setCachedPreview(cacheKey, result, now);
    return result;
  } catch (error) {
    if (isBlockedPreviewError(error)) {
      const blocked = buildBlockedPreviewResolution(parsed.normalizedUrl);
      setCachedPreview(cacheKey, blocked, now);
      return blocked;
    }
    throw error;
  }
}

export function __clearSourcePreviewResolverCacheForTests() {
  clearSourcePreviewCacheForTests();
}

export function __getSourcePreviewResolverCacheSizeForTests() {
  return getSourcePreviewCacheSizeForTests();
}
