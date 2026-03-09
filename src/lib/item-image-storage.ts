import { parseSourceArtworkPlaceholderImageUrl } from "@/lib/item-artwork-placeholder";
import {
  detectExternalSourceKind,
  parseAnyItemSource,
  resolveItemImageUrlForWrite,
} from "@/lib/item-source";
import { processImageBuffer, saveUploadedImage } from "@/lib/upload";
import { extractManagedUploadFilename } from "@/lib/uploads";

const REMOTE_THUMBNAIL_FETCH_TIMEOUT_MS = 5_000;
const REMOTE_THUMBNAIL_MAX_BYTES = 8 * 1024 * 1024;
const REMOTE_THUMBNAIL_HOST_SUFFIX_ALLOWLIST = [
  "ytimg.com",
  "img.youtube.com",
  "spotifycdn.com",
  "scdn.co",
  "vimeocdn.com",
  "sndcdn.com",
  "muscdn.com",
  "cdninstagram.com",
  "fbcdn.net",
  "giphy.com",
];
const REMOTE_THUMBNAIL_HOST_PATTERN_ALLOWLIST = [
  /(^|\.)[a-z0-9-]*tiktokcdn[a-z0-9-]*\.(com|net)$/i,
];

interface DownloadedRemoteThumbnailImage {
  buffer: Buffer;
  contentType: string;
}

function parseHttpsUrl(input: string): URL | null {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isTrustedThumbnailHost(host: string): boolean {
  const normalizedHost = host.trim().toLowerCase();
  if (!normalizedHost) return false;
  if (
    REMOTE_THUMBNAIL_HOST_SUFFIX_ALLOWLIST.some(
      (suffix) => normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`),
    )
  ) {
    return true;
  }
  return REMOTE_THUMBNAIL_HOST_PATTERN_ALLOWLIST.some((pattern) => pattern.test(normalizedHost));
}

function isEligibleSourceForThumbnailIngestion(sourceUrl: string | null | undefined): boolean {
  if (!sourceUrl) return false;
  const parsedSource = parseAnyItemSource(sourceUrl);
  if (!parsedSource) return false;
  if (parsedSource.provider === "YOUTUBE" || parsedSource.provider === "SPOTIFY") return true;

  const sourceKind = detectExternalSourceKind(parsedSource.normalizedUrl);
  return (
    sourceKind === "IMAGE" ||
    sourceKind === "VIMEO" ||
    sourceKind === "SOUNDCLOUD" ||
    sourceKind === "TIKTOK" ||
    sourceKind === "INSTAGRAM"
  );
}

function canIngestRemoteThumbnail(
  imageUrl: string,
  sourceUrl: string | null | undefined,
): URL | null {
  if (!isEligibleSourceForThumbnailIngestion(sourceUrl)) return null;
  if (extractManagedUploadFilename(imageUrl)) return null;
  if (parseSourceArtworkPlaceholderImageUrl(imageUrl)) return null;

  const parsedImageUrl = parseHttpsUrl(imageUrl);
  if (!parsedImageUrl) return null;
  const host = parsedImageUrl.hostname.toLowerCase();
  return isTrustedThumbnailHost(host) ? parsedImageUrl : null;
}

function shouldStoreAsStillThumbnail(url: URL, contentType: string): boolean {
  return contentType.startsWith("image/gif") || url.pathname.toLowerCase().endsWith(".gif");
}

async function downloadRemoteThumbnailImage(
  url: URL,
): Promise<DownloadedRemoteThumbnailImage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_THUMBNAIL_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "error",
      headers: { accept: "image/*" },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("image/")) return null;

    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(contentLength) && contentLength > REMOTE_THUMBNAIL_MAX_BYTES) {
        return null;
      }
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer.byteLength || arrayBuffer.byteLength > REMOTE_THUMBNAIL_MAX_BYTES) {
      return null;
    }

    return { buffer: Buffer.from(arrayBuffer), contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveItemImageUrlForCreate(
  imageUrl: string | null | undefined,
  sourceUrl: string | null | undefined,
): Promise<string> {
  const resolvedImageUrl = resolveItemImageUrlForWrite(imageUrl, sourceUrl);
  const thumbnailUrl = canIngestRemoteThumbnail(resolvedImageUrl, sourceUrl);
  if (!thumbnailUrl) return resolvedImageUrl;

  const downloadedThumbnail = await downloadRemoteThumbnailImage(thumbnailUrl);
  if (!downloadedThumbnail) return resolvedImageUrl;
  const { buffer: thumbnailBuffer, contentType } = downloadedThumbnail;

  try {
    if (shouldStoreAsStillThumbnail(thumbnailUrl, contentType)) {
      const stillThumbnailBuffer = await processImageBuffer(thumbnailBuffer, "item");
      return await saveUploadedImage(stillThumbnailBuffer, { variant: "item" });
    }
    return await saveUploadedImage(thumbnailBuffer, { variant: "item" });
  } catch {
    return resolvedImageUrl;
  }
}
