import type { ExternalSourceKind, ItemSourceProvider } from "@/lib/item-source";

export type SourcePreviewEmbedType = "iframe" | "image" | "video" | "audio" | null;

export interface SourcePreviewResolution {
  sourceUrl: string;
  provider: ItemSourceProvider | null;
  youtubeContentKind: "VIDEO" | "SHORTS" | null;
  durationSec: number | null;
  kind: ExternalSourceKind | null;
  label: string;
  embedUrl: string | null;
  embedType: SourcePreviewEmbedType;
  thumbnailUrl: string | null;
  title: string | null;
  description: string | null;
  siteName: string | null;
  note: string | null;
  resolvedBy: "native" | "resolver" | "none";
}

export interface ResolveSourcePreviewOptions {
  detectYouTubeContentKind?: boolean;
  includeYouTubeDuration?: boolean;
}

export interface OEmbedMetadata {
  thumbnailUrl: string | null;
  title: string | null;
  durationSec: number | null;
}

export interface UnfurlMetadata extends OEmbedMetadata {
  description: string | null;
  siteName: string | null;
}

export interface ResolverPreviewResolution extends OEmbedMetadata {
  embedUrl: string | null;
  canonicalSourceUrl: string | null;
}

export interface YouTubeOEmbedMetadata extends OEmbedMetadata {
  contentKind: "VIDEO" | "SHORTS" | null;
}
