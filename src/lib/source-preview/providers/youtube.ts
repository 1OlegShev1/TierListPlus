import type { ParsedItemSource } from "@/lib/item-source";
import { MAX_HTML_PREVIEW_BYTES, OEMBED_FETCH_TIMEOUT_MS } from "@/lib/source-preview/constants";
import { fetchWithPolicy, readResponseTextLimited } from "@/lib/source-preview/http";
import {
  extractYouTubeDurationSecondsFromHtml,
  normalizeMetadataTitle,
  parseOEmbedMetadata,
} from "@/lib/source-preview/metadata";
import type {
  ResolveSourcePreviewOptions,
  YouTubeOEmbedMetadata,
} from "@/lib/source-preview/types";

async function detectYouTubeContentKindViaOEmbed(videoId: string): Promise<YouTubeOEmbedMetadata> {
  const shortsUrl = `https://www.youtube.com/shorts/${videoId}`;
  const oEmbedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(shortsUrl)}`;
  const fetched = await fetchWithPolicy(oEmbedUrl, {}, { timeoutMs: OEMBED_FETCH_TIMEOUT_MS });
  if (!fetched?.response.ok) {
    return { contentKind: null, thumbnailUrl: null, title: null, durationSec: null };
  }

  const payload = (await fetched.response.json()) as {
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
      durationSec: metadata.durationSec,
    };
  }

  if (typeof payload.thumbnail_url === "string" && payload.thumbnail_url.includes("/hq2")) {
    return {
      contentKind: "SHORTS",
      thumbnailUrl: metadata.thumbnailUrl,
      title: metadata.title,
      durationSec: metadata.durationSec,
    };
  }

  return {
    contentKind: null,
    thumbnailUrl: metadata.thumbnailUrl,
    title: metadata.title,
    durationSec: metadata.durationSec,
  };
}

async function resolveYouTubeDurationViaWatchPage(videoId: string): Promise<number | null> {
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const fetched = await fetchWithPolicy(watchUrl, {}, { timeoutMs: OEMBED_FETCH_TIMEOUT_MS });
  if (!fetched?.response.ok) {
    return null;
  }
  const html = await readResponseTextLimited(fetched.response, MAX_HTML_PREVIEW_BYTES);
  if (!html) return null;
  return extractYouTubeDurationSecondsFromHtml(html);
}

export async function resolveYouTubePreview(
  parsed: ParsedItemSource,
  options: ResolveSourcePreviewOptions,
): Promise<{
  youtubeContentKind: "VIDEO" | "SHORTS" | null;
  thumbnailUrl: string | null;
  title: string | null;
  durationSec: number | null;
}> {
  let youtubeContentKind = parsed.youtubeContentKind;
  let thumbnailUrl = parsed.thumbnailUrl;
  let title: string | null = null;
  let durationSec: number | null = null;

  if (options.detectYouTubeContentKind && parsed.youtubeVideoId) {
    const metadata = await detectYouTubeContentKindViaOEmbed(parsed.youtubeVideoId);
    if (metadata.contentKind === "SHORTS") {
      youtubeContentKind = "SHORTS";
    }
    thumbnailUrl = metadata.thumbnailUrl ?? thumbnailUrl;
    title = normalizeMetadataTitle(metadata.title);
    if (options.includeYouTubeDuration) {
      durationSec = metadata.durationSec;
    }
  }

  if (options.includeYouTubeDuration && parsed.youtubeVideoId) {
    durationSec = durationSec ?? (await resolveYouTubeDurationViaWatchPage(parsed.youtubeVideoId));
  }

  return {
    youtubeContentKind,
    thumbnailUrl,
    title,
    durationSec,
  };
}
