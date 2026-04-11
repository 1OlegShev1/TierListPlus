import { buildExternalSourceEmbedUrl, type ExternalSourceResolver } from "@/lib/item-source";
import {
  OEMBED_FETCH_TIMEOUT_MS,
  RESOLVER_EMBED_HOST_ALLOWLIST,
  RESOLVER_HOST_ALLOWLIST,
} from "@/lib/source-preview/constants";
import { fetchWithPolicy } from "@/lib/source-preview/http";
import { parseOEmbedMetadata } from "@/lib/source-preview/metadata";
import type { OEmbedMetadata, ResolverPreviewResolution } from "@/lib/source-preview/types";

export function isResolverHostAllowed(resolver: ExternalSourceResolver, host: string): boolean {
  return RESOLVER_HOST_ALLOWLIST[resolver].has(host);
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
  return allowedHosts.size > 0 && allowedHosts.has(parsed.hostname.toLowerCase());
}

async function resolveTrustedRedirectTarget(
  resolver: ExternalSourceResolver,
  sourceUrl: string,
): Promise<string | null> {
  let currentUrl = sourceUrl;
  for (let hop = 0; hop <= 4; hop += 1) {
    const fetched = await fetchWithPolicy(
      currentUrl,
      {},
      { timeoutMs: OEMBED_FETCH_TIMEOUT_MS, followRedirects: false, maxRedirects: 0 },
    );
    if (!fetched) return null;
    const { response } = fetched;

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      let target: URL;
      try {
        target = new URL(location, currentUrl);
      } catch {
        return null;
      }
      if (!["https:", "http:"].includes(target.protocol)) return null;
      if (target.username || target.password) return null;
      if (!isResolverHostAllowed(resolver, target.hostname.toLowerCase())) return null;
      currentUrl = target.toString();
      continue;
    }

    return response.ok ? currentUrl : null;
  }

  return null;
}

async function resolveTikTokMetadataViaOEmbed(sourceUrl: string): Promise<OEmbedMetadata> {
  const oEmbedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(sourceUrl)}`;
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

export async function resolveEmbedUrlViaOEmbed(
  resolver: ExternalSourceResolver,
  sourceUrl: string,
): Promise<ResolverPreviewResolution> {
  if (resolver === "SOUNDCLOUD_OEMBED") {
    const url = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(sourceUrl)}`;
    const fetched = await fetchWithPolicy(url, {}, { timeoutMs: OEMBED_FETCH_TIMEOUT_MS });
    if (!fetched?.response.ok) {
      return {
        embedUrl: null,
        thumbnailUrl: null,
        title: null,
        durationSec: null,
        canonicalSourceUrl: null,
      };
    }
    const payload = (await fetched.response.json()) as {
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
      return {
        embedUrl: null,
        thumbnailUrl: null,
        title: null,
        durationSec: null,
        canonicalSourceUrl: null,
      };
    }
    const metadata = await resolveTikTokMetadataViaOEmbed(finalUrl);
    return {
      embedUrl: buildExternalSourceEmbedUrl(finalUrl, null),
      thumbnailUrl: metadata.thumbnailUrl,
      title: metadata.title,
      durationSec: metadata.durationSec,
      canonicalSourceUrl: finalUrl,
    };
  }

  return {
    embedUrl: null,
    thumbnailUrl: null,
    title: null,
    durationSec: null,
    canonicalSourceUrl: null,
  };
}
