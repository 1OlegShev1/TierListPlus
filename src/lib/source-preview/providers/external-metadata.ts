import { MAX_HTML_PREVIEW_BYTES, OEMBED_FETCH_TIMEOUT_MS } from "@/lib/source-preview/constants";
import { fetchWithPolicy, readResponseTextLimited } from "@/lib/source-preview/http";
import {
  extractCanonicalHref,
  extractMetaTagContent,
  extractTitleTagContent,
  normalizeMetadataDescription,
  normalizeMetadataTitle,
  normalizeMetadataUrl,
  parseOEmbedMetadata,
  stripHtmlTags,
} from "@/lib/source-preview/metadata";
import type { OEmbedMetadata, UnfurlMetadata } from "@/lib/source-preview/types";

export async function resolveVimeoMetadataViaOEmbed(sourceUrl: string): Promise<OEmbedMetadata> {
  const oEmbedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(sourceUrl)}`;
  const fetched = await fetchWithPolicy(oEmbedUrl, {}, { timeoutMs: OEMBED_FETCH_TIMEOUT_MS });
  if (!fetched?.response.ok) {
    return { thumbnailUrl: null, title: null, durationSec: null };
  }
  const payload = (await fetched.response.json()) as {
    title?: unknown;
    thumbnail_url?: unknown;
  };
  return parseOEmbedMetadata(payload);
}

export async function resolveInstagramMetadataViaHtml(sourceUrl: string): Promise<OEmbedMetadata> {
  const fetched = await fetchWithPolicy(sourceUrl, {}, { timeoutMs: OEMBED_FETCH_TIMEOUT_MS });
  if (!fetched?.response.ok) {
    return { thumbnailUrl: null, title: null, durationSec: null };
  }
  const html = await readResponseTextLimited(fetched.response, 200_000);
  if (!html) return { thumbnailUrl: null, title: null, durationSec: null };
  const title = normalizeMetadataTitle(
    extractMetaTagContent(html, "og:title") ?? extractMetaTagContent(html, "twitter:title"),
  );
  const thumbnailUrl = normalizeMetadataUrl(
    extractMetaTagContent(html, "og:image") ?? extractMetaTagContent(html, "twitter:image"),
  );
  return { thumbnailUrl, title, durationSec: null };
}

export async function resolveXMetadataViaOEmbed(sourceUrl: string): Promise<OEmbedMetadata> {
  let normalizedUrl = sourceUrl;
  try {
    const parsed = new URL(sourceUrl);
    const host = parsed.hostname.toLowerCase();
    if (host === "x.com" || host === "www.x.com") {
      parsed.hostname = "twitter.com";
    }
    normalizedUrl = parsed.toString();
  } catch {
    // Keep original URL.
  }

  const oEmbedUrl = `https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(normalizedUrl)}`;
  const fetched = await fetchWithPolicy(oEmbedUrl, {}, { timeoutMs: OEMBED_FETCH_TIMEOUT_MS });
  if (!fetched?.response.ok) {
    return { thumbnailUrl: null, title: null, durationSec: null };
  }

  const payload = (await fetched.response.json()) as {
    html?: unknown;
    author_name?: unknown;
  };
  const authorName = normalizeMetadataTitle(payload.author_name);
  const body =
    typeof payload.html === "string"
      ? (payload.html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? payload.html)
      : "";
  const title = normalizeMetadataTitle(stripHtmlTags(body)) ?? authorName;
  return { thumbnailUrl: null, title, durationSec: null };
}

export async function resolveGenericMetadataViaHtml(sourceUrl: string): Promise<UnfurlMetadata> {
  const fetched = await fetchWithPolicy(
    sourceUrl,
    { headers: { accept: "text/html,application/xhtml+xml" } },
    { timeoutMs: OEMBED_FETCH_TIMEOUT_MS, followRedirects: true },
  );
  if (!fetched?.response.ok) {
    return {
      thumbnailUrl: null,
      title: null,
      durationSec: null,
      description: null,
      siteName: null,
    };
  }

  const contentType = fetched.response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    return {
      thumbnailUrl: null,
      title: null,
      durationSec: null,
      description: null,
      siteName: null,
    };
  }

  const html = await readResponseTextLimited(fetched.response, MAX_HTML_PREVIEW_BYTES);
  if (!html) {
    return {
      thumbnailUrl: null,
      title: null,
      durationSec: null,
      description: null,
      siteName: null,
    };
  }
  const title = normalizeMetadataTitle(
    extractMetaTagContent(html, "og:title") ??
      extractMetaTagContent(html, "twitter:title") ??
      extractTitleTagContent(html),
  );
  const description = normalizeMetadataDescription(
    extractMetaTagContent(html, "og:description") ??
      extractMetaTagContent(html, "twitter:description") ??
      extractMetaTagContent(html, "description"),
  );
  const thumbnailUrl = normalizeMetadataUrl(
    extractMetaTagContent(html, "og:image") ??
      extractMetaTagContent(html, "og:image:url") ??
      extractMetaTagContent(html, "twitter:image"),
  );
  const siteName = normalizeMetadataTitle(
    extractMetaTagContent(html, "og:site_name") ?? extractMetaTagContent(html, "application-name"),
  );
  const canonicalUrl = normalizeMetadataUrl(
    extractMetaTagContent(html, "og:url") ?? extractCanonicalHref(html),
  );

  return {
    thumbnailUrl,
    title,
    durationSec: null,
    description,
    siteName:
      siteName ?? (canonicalUrl ? new URL(canonicalUrl).hostname.replace(/^www\./i, "") : null),
  };
}
