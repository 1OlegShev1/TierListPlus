import type { CSSProperties } from "react";
import type { ItemSourceProvider } from "@/types";

export type ItemSourceModalMode = "EDIT_SOURCE" | "CREATE_FROM_URL";

export interface ItemSourceModalProps {
  open: boolean;
  mode?: ItemSourceModalMode;
  itemLabel: string;
  itemImageUrl?: string | null;
  sourceUrl?: string | null;
  sourceProvider?: ItemSourceProvider | null;
  sourceNote?: string | null;
  sourceStartSec?: number | null;
  sourceEndSec?: number | null;
  editable: boolean;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave?: (next: {
    sourceUrl: string | null;
    sourceNote: string | null;
    sourceStartSec: number | null;
    sourceEndSec: number | null;
    itemLabel?: string | null;
    resolvedImageUrl?: string | null;
    resolvedTitle?: string | null;
  }) => Promise<boolean>;
}

export type ResolvedExternalPreview = {
  kind: import("@/lib/item-source").ExternalSourceKind | null;
  label: string;
  embedUrl: string | null;
  embedType: "iframe" | "image" | "video" | "audio" | null;
  description: string | null;
  siteName: string | null;
  note: string | null;
};

export type SourcePreviewResolutionPayload = ResolvedExternalPreview & {
  provider: ItemSourceProvider | null;
  youtubeContentKind: "VIDEO" | "SHORTS" | null;
  durationSec: number | null;
  thumbnailUrl: string | null;
  title: string | null;
};

export interface SourcePreviewPanelModel {
  hasSource: boolean;
  activeSourceUrl: string | null;
  hasInvalidDraftSource: boolean;
  isCreateFromUrlMode: boolean;
  previewImageUrl: string | null;
  previewItemLabel: string;
  externalSourceLabel: string;
  displayNote: string;
  canShowLargePreview: boolean;
  expandedPreviewUrl: string | null;
  youtubeEmbedUrl: string | null;
  isPortraitYouTubeEmbed: boolean;
  spotifyEmbedUrl: string | null;
  spotifyEmbedHeight: number;
  activeProvider: ItemSourceProvider | null;
  externalEmbedUrl: string | null;
  externalEmbedType: "iframe" | "image" | "video" | "audio" | null;
  externalSourceKind: import("@/lib/item-source").ExternalSourceKind | null;
  soundCloudEmbedHeight: number;
  externalIframeClassName: string;
  externalIframeStyle: CSSProperties | undefined;
  externalPreviewNote: string | null;
  shouldShowGenericUnfurlCard: boolean;
  resolvedThumbnailUrl: string | null;
  resolvedExternalSiteName: string | null;
  genericUnfurlHost: string | null;
  resolvedSourceTitle: string | null;
  resolvedExternalDescription: string | null;
}
