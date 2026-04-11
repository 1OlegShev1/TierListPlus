import {
  buildExternalSourceEmbedUrl,
  detectExternalSourceKind,
  type ExternalSourceKind,
  getExternalSourceCapability,
} from "@/lib/item-source";
import {
  resolveGenericMetadataViaHtml,
  resolveInstagramMetadataViaHtml,
  resolveVimeoMetadataViaOEmbed,
  resolveXMetadataViaOEmbed,
} from "@/lib/source-preview/providers/external-metadata";
import {
  isResolverHostAllowed,
  resolveEmbedUrlViaOEmbed,
} from "@/lib/source-preview/providers/external-oembed";
import type { SourcePreviewEmbedType, SourcePreviewResolution } from "@/lib/source-preview/types";

function getEmbedTypeForKind(kind: ExternalSourceKind | null): SourcePreviewEmbedType {
  if (!kind) return null;
  switch (kind) {
    case "IMAGE":
      return "image";
    case "VIDEO":
      return "video";
    case "AUDIO":
      return "audio";
    default:
      return "iframe";
  }
}

export async function resolveExternalSourcePreview(
  sourceUrl: string,
  parentHostname: string | null,
): Promise<{
  kind: ExternalSourceKind | null;
  label: string;
  embedUrl: string | null;
  embedType: SourcePreviewEmbedType;
  thumbnailUrl: string | null;
  title: string | null;
  description: string | null;
  siteName: string | null;
  durationSec: number | null;
  note: string | null;
  resolvedBy: SourcePreviewResolution["resolvedBy"];
}> {
  const kind = detectExternalSourceKind(sourceUrl);
  const capability = getExternalSourceCapability(kind);
  const label = capability?.label ?? "External link";
  const embedType = getEmbedTypeForKind(kind);
  let embedUrl = buildExternalSourceEmbedUrl(sourceUrl, parentHostname);
  let resolvedBy: SourcePreviewResolution["resolvedBy"] = embedUrl ? "native" : "none";
  let thumbnailUrl: string | null = kind === "IMAGE" ? sourceUrl : null;
  let title: string | null = null;
  let durationSec: number | null = null;
  let description: string | null = null;
  let siteName: string | null = null;
  let canonicalSourceUrl = sourceUrl;
  let attemptedResolverMetadata = false;

  if (!embedUrl && capability?.resolver && kind) {
    const host = new URL(sourceUrl).hostname.toLowerCase();
    if (isResolverHostAllowed(capability.resolver, host)) {
      attemptedResolverMetadata = true;
      const resolvedPreview = await resolveEmbedUrlViaOEmbed(capability.resolver, sourceUrl);
      embedUrl = resolvedPreview.embedUrl;
      thumbnailUrl = resolvedPreview.thumbnailUrl ?? thumbnailUrl;
      title = resolvedPreview.title;
      canonicalSourceUrl = resolvedPreview.canonicalSourceUrl ?? canonicalSourceUrl;
      if (resolvedPreview.embedUrl) resolvedBy = "resolver";
    }
  }

  if (kind === "VIMEO") {
    const metadata = await resolveVimeoMetadataViaOEmbed(canonicalSourceUrl);
    thumbnailUrl = metadata.thumbnailUrl ?? thumbnailUrl;
    title = metadata.title ?? title;
    durationSec = metadata.durationSec ?? durationSec;
  } else if (kind === "SOUNDCLOUD" && !attemptedResolverMetadata && !thumbnailUrl && !title) {
    const metadata = await resolveEmbedUrlViaOEmbed("SOUNDCLOUD_OEMBED", canonicalSourceUrl);
    if (!embedUrl && metadata.embedUrl) {
      embedUrl = metadata.embedUrl;
      resolvedBy = "resolver";
    }
    thumbnailUrl = metadata.thumbnailUrl ?? thumbnailUrl;
    title = metadata.title ?? title;
    durationSec = metadata.durationSec ?? durationSec;
  } else if (kind === "TIKTOK" && !thumbnailUrl && !title) {
    const metadata = await resolveEmbedUrlViaOEmbed("TIKTOK_OEMBED", canonicalSourceUrl);
    if (!embedUrl && metadata.embedUrl) {
      embedUrl = metadata.embedUrl;
      resolvedBy = "resolver";
    }
    thumbnailUrl = metadata.thumbnailUrl ?? thumbnailUrl;
    title = metadata.title ?? title;
    durationSec = metadata.durationSec ?? durationSec;
  } else if (kind === "INSTAGRAM" && !thumbnailUrl && !title) {
    const metadata = await resolveInstagramMetadataViaHtml(canonicalSourceUrl);
    thumbnailUrl = metadata.thumbnailUrl ?? thumbnailUrl;
    title = metadata.title ?? title;
    durationSec = metadata.durationSec ?? durationSec;
  } else if (kind === "X" && !title) {
    const metadata = await resolveXMetadataViaOEmbed(canonicalSourceUrl);
    title = metadata.title ?? title;
    durationSec = metadata.durationSec ?? durationSec;
  } else if (kind === "GENERIC") {
    const metadata = await resolveGenericMetadataViaHtml(canonicalSourceUrl);
    thumbnailUrl = metadata.thumbnailUrl ?? thumbnailUrl;
    title = metadata.title ?? title;
    durationSec = metadata.durationSec ?? durationSec;
    description = metadata.description ?? description;
    siteName = metadata.siteName ?? siteName;
  }

  const hasUnfurlMetadata = !!(title || thumbnailUrl || description || siteName);
  const note = embedUrl
    ? null
    : kind === "GENERIC" && hasUnfurlMetadata
      ? null
      : (capability?.fallbackNote ?? "No inline preview for this link type yet.");

  return {
    kind,
    label,
    embedUrl: embedUrl ?? null,
    embedType: embedUrl ? embedType : null,
    thumbnailUrl,
    title,
    description,
    siteName,
    durationSec,
    note,
    resolvedBy,
  };
}
