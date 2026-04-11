import { OEMBED_FETCH_TIMEOUT_MS } from "@/lib/source-preview/constants";
import { fetchWithPolicy } from "@/lib/source-preview/http";
import { parseOEmbedMetadata } from "@/lib/source-preview/metadata";
import type { OEmbedMetadata } from "@/lib/source-preview/types";

export async function resolveSpotifyMetadataViaOEmbed(sourceUrl: string): Promise<OEmbedMetadata> {
  const oEmbedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(sourceUrl)}`;
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
