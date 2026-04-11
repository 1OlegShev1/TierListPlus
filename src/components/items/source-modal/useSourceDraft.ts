"use client";

import { useMemo } from "react";
import type { SourcePreviewPanelModel } from "@/components/items/source-modal/types";
import { useSourcePreviewResolution } from "@/components/items/source-modal/useSourcePreviewResolution";
import {
  formatDurationLabel,
  isTwitchClipSourceUrl,
  parseOptionalTimeToSeconds,
} from "@/components/items/source-modal/utils";
import {
  buildExternalSourceEmbedUrl,
  buildYouTubeEmbedUrl,
  detectExternalSourceKind,
  getExternalSourceCapability,
  getExternalSourceKindLabel,
  getItemSourceProviderLabel,
  INVALID_ITEM_SOURCE_MESSAGE,
  type ItemSourceProvider,
  normalizeItemLabel,
  parseAnyItemSource,
  resolveItemImageUrlForWrite,
  suggestItemLabelFromSourceUrl,
} from "@/lib/item-source";

interface UseSourceDraftArgs {
  mode: "EDIT_SOURCE" | "CREATE_FROM_URL";
  itemLabel: string;
  itemImageUrl: string | null;
  sourceUrl: string | null | undefined;
  sourceProvider: ItemSourceProvider | null | undefined;
  sourceNote: string | null | undefined;
  sourceStartSec: number | null | undefined;
  sourceEndSec: number | null | undefined;
  draftUrl: string;
  draftLabel: string;
  draftNote: string;
  draftStartSec: string;
  draftEndSec: string;
  draftReplacementImageUrl: string | null;
  embedParentHostname: string;
  editable: boolean;
  saving: boolean;
  isUploadingCustomImage: boolean;
  hasSaveHandler: boolean;
}

export function useSourceDraft({
  mode,
  itemLabel,
  itemImageUrl,
  sourceUrl,
  sourceProvider,
  sourceNote,
  sourceStartSec,
  sourceEndSec,
  draftUrl,
  draftLabel,
  draftNote,
  draftStartSec,
  draftEndSec,
  draftReplacementImageUrl,
  embedParentHostname,
  editable,
  saving,
  isUploadingCustomImage,
  hasSaveHandler,
}: UseSourceDraftArgs) {
  const isCreateFromUrlMode = mode === "CREATE_FROM_URL";
  const trimmedDraftUrl = draftUrl.trim();
  const trimmedDraftNote = draftNote.trim();

  const parsedSavedSource = useMemo(
    () => (sourceUrl ? parseAnyItemSource(sourceUrl) : null),
    [sourceUrl],
  );
  const parsedDraftSource = useMemo(
    () => (trimmedDraftUrl ? parseAnyItemSource(trimmedDraftUrl) : null),
    [trimmedDraftUrl],
  );
  const hasInvalidDraftSource = trimmedDraftUrl.length > 0 && !parsedDraftSource;
  const activeParsedSource = trimmedDraftUrl.length > 0 ? parsedDraftSource : parsedSavedSource;
  const activeSourceUrl = activeParsedSource?.normalizedUrl ?? null;
  const activeProvider = activeParsedSource
    ? activeParsedSource.provider
    : (sourceProvider ?? null);
  const hasSource = !!activeParsedSource;

  const shouldValidateIntervals =
    trimmedDraftUrl.length > 0 && parsedDraftSource?.provider === "YOUTUBE";
  const hasIntervalInput =
    draftStartSec.trim().length > 0 ||
    draftEndSec.trim().length > 0 ||
    typeof sourceStartSec === "number" ||
    typeof sourceEndSec === "number";
  const shouldResolveDurationMetadata = shouldValidateIntervals && hasIntervalInput;

  const fallbackExternalKind =
    activeProvider === null ? detectExternalSourceKind(activeSourceUrl) : null;
  const fallbackExternalCapability = getExternalSourceCapability(fallbackExternalKind);
  const fallbackExternalEmbedUrl =
    activeProvider === null
      ? buildExternalSourceEmbedUrl(activeSourceUrl, embedParentHostname)
      : null;

  const {
    resolvedExternalPreview,
    resolvedYouTubeContentKind,
    resolvedThumbnailUrl,
    resolvedSourceTitle,
    resolvedSourceDescription,
    resolvedSourceSiteName,
    resolvedSourceDurationSec,
    isResolvingSourcePreview,
    isResolvingDurationMetadata,
    hasDurationResolutionAttempted,
  } = useSourcePreviewResolution({
    activeSourceUrl,
    activeProvider,
    activeParsedSourceProvider: activeParsedSource?.provider,
    fallbackExternalKind,
    fallbackExternalCapabilityPreviewMode: fallbackExternalCapability?.previewMode ?? null,
    fallbackExternalEmbedUrl,
    embedParentHostname,
    isCreateFromUrlMode,
    shouldResolveDurationMetadata,
  });

  const parsedDraftStartSec = parseOptionalTimeToSeconds(draftStartSec);
  const parsedDraftEndSec = parseOptionalTimeToSeconds(draftEndSec);
  const resolvedDurationLabel = formatDurationLabel(resolvedSourceDurationSec);
  const intervalInvalidReason = shouldValidateIntervals
    ? parsedDraftStartSec === "invalid"
      ? "Invalid start time. Use sec, mm:ss, or hh:mm:ss (e.g. 90, 1:30, 1:02:30)."
      : parsedDraftEndSec === "invalid"
        ? "Invalid end time. Use sec, mm:ss, or hh:mm:ss (e.g. 90, 1:30, 1:02:30)."
        : typeof parsedDraftStartSec === "number" &&
            typeof parsedDraftEndSec === "number" &&
            parsedDraftEndSec <= parsedDraftStartSec
          ? "End time must be greater than start time."
          : typeof parsedDraftStartSec === "number" &&
              typeof resolvedSourceDurationSec === "number" &&
              parsedDraftStartSec >= resolvedSourceDurationSec
            ? `Start time must be before clip end (${resolvedDurationLabel ?? "known duration"}).`
            : typeof parsedDraftEndSec === "number" &&
                typeof resolvedSourceDurationSec === "number" &&
                parsedDraftEndSec > resolvedSourceDurationSec
              ? `End time can be at most ${resolvedDurationLabel ?? "clip duration"}.`
              : null
    : null;

  const resolvedStartSec =
    shouldValidateIntervals && typeof parsedDraftStartSec === "number"
      ? parsedDraftStartSec
      : (sourceStartSec ?? null);
  const resolvedEndSec =
    shouldValidateIntervals && typeof parsedDraftEndSec === "number"
      ? parsedDraftEndSec
      : (sourceEndSec ?? null);

  const youtubeEmbedUrl =
    activeParsedSource?.provider === "YOUTUBE" && activeParsedSource.youtubeVideoId
      ? buildYouTubeEmbedUrl(
          activeParsedSource.youtubeVideoId,
          resolvedStartSec,
          resolvedEndSec,
          activeParsedSource.youtubeContentKind === "SHORTS"
            ? "SHORTS"
            : (resolvedYouTubeContentKind ?? activeParsedSource.youtubeContentKind),
        )
      : null;
  const isPortraitYouTubeEmbed =
    activeParsedSource?.provider === "YOUTUBE" &&
    (activeParsedSource.youtubeContentKind === "SHORTS" || resolvedYouTubeContentKind === "SHORTS");
  const spotifyEmbedUrl =
    activeParsedSource?.provider === "SPOTIFY" ? activeParsedSource.embedUrl : null;
  const spotifyEmbedHeight =
    spotifyEmbedUrl && /\/embed\/(track|episode)\//.test(spotifyEmbedUrl) ? 152 : 352;
  const externalSourceKind =
    activeProvider === null ? (resolvedExternalPreview?.kind ?? fallbackExternalKind) : null;
  const externalSourceLabel = activeProvider
    ? getItemSourceProviderLabel(activeProvider)
    : (resolvedExternalPreview?.label ??
      getExternalSourceKindLabel(fallbackExternalKind) ??
      "External link");
  const externalEmbedUrl =
    activeProvider === null
      ? (resolvedExternalPreview?.embedUrl ?? fallbackExternalEmbedUrl ?? null)
      : null;
  const externalEmbedType =
    activeProvider === null
      ? (resolvedExternalPreview?.embedType ??
        (fallbackExternalEmbedUrl
          ? fallbackExternalKind === "IMAGE"
            ? "image"
            : fallbackExternalKind === "VIDEO"
              ? "video"
              : fallbackExternalKind === "AUDIO"
                ? "audio"
                : "iframe"
          : null))
      : null;
  const soundCloudEmbedHeight =
    externalSourceKind === "SOUNDCLOUD" && (activeSourceUrl ?? "").toLowerCase().includes("/sets/")
      ? 352
      : 166;
  const isPortraitExternalEmbed =
    externalEmbedType === "iframe" &&
    (externalSourceKind === "INSTAGRAM" ||
      externalSourceKind === "TIKTOK" ||
      (externalSourceKind === "TWITCH" && isTwitchClipSourceUrl(activeSourceUrl)));
  const canShowLargePreview =
    (isPortraitExternalEmbed && !!externalEmbedUrl) ||
    (isPortraitYouTubeEmbed && !!youtubeEmbedUrl);
  const expandedPreviewUrl = isPortraitExternalEmbed
    ? externalEmbedUrl
    : isPortraitYouTubeEmbed
      ? youtubeEmbedUrl
      : null;
  const compactExternalIframeHeight = externalSourceKind === "X" ? 280 : null;
  const externalIframeClassName =
    compactExternalIframeHeight || isPortraitExternalEmbed ? "w-full" : "aspect-video w-full";
  const externalIframeStyle = isPortraitExternalEmbed
    ? { height: "min(52dvh, 30rem)" }
    : compactExternalIframeHeight
      ? { height: compactExternalIframeHeight }
      : undefined;
  const externalPreviewNote =
    resolvedExternalPreview?.note ??
    (!externalEmbedUrl ? (fallbackExternalCapability?.fallbackNote ?? null) : null);
  const resolvedExternalDescription =
    resolvedExternalPreview?.description ?? resolvedSourceDescription;
  const resolvedExternalSiteName = resolvedExternalPreview?.siteName ?? resolvedSourceSiteName;
  const shouldShowGenericUnfurlCard =
    activeProvider === null &&
    (externalSourceKind === "GENERIC" || (externalSourceKind === "TWITCH" && !externalEmbedUrl)) &&
    !!(
      resolvedSourceTitle ||
      resolvedExternalDescription ||
      resolvedThumbnailUrl ||
      resolvedExternalSiteName
    );
  const genericUnfurlHost = (() => {
    try {
      return activeSourceUrl ? new URL(activeSourceUrl).hostname.replace(/^www\./i, "") : null;
    } catch {
      return null;
    }
  })();

  const resolvedPreviewTitle = isCreateFromUrlMode ? normalizeItemLabel(resolvedSourceTitle) : "";
  const suggestedLabelFromUrl =
    isCreateFromUrlMode && activeSourceUrl ? suggestItemLabelFromSourceUrl(activeSourceUrl) : "";
  const fallbackCreateLabel = normalizeItemLabel(
    resolvedPreviewTitle || suggestedLabelFromUrl || itemLabel || "New item",
  );
  const resolvedDraftLabel = normalizeItemLabel(draftLabel);
  const previewItemLabel = isCreateFromUrlMode
    ? resolvedDraftLabel || fallbackCreateLabel
    : itemLabel;
  const autoResolvedImageUrl = (() => {
    if (!isCreateFromUrlMode && itemImageUrl) return itemImageUrl;
    if (resolvedThumbnailUrl) return resolvedThumbnailUrl;
    if (!activeSourceUrl) return activeParsedSource?.thumbnailUrl ?? null;
    try {
      return resolveItemImageUrlForWrite(undefined, activeSourceUrl);
    } catch {
      return activeParsedSource?.thumbnailUrl ?? null;
    }
  })();
  const selectedImageUrl = draftReplacementImageUrl ?? autoResolvedImageUrl;
  const previewImageUrl = selectedImageUrl ?? autoResolvedImageUrl;
  const previewPanelModel: SourcePreviewPanelModel = {
    hasSource,
    activeSourceUrl,
    hasInvalidDraftSource,
    isCreateFromUrlMode,
    previewImageUrl,
    previewItemLabel,
    externalSourceLabel,
    displayNote: trimmedDraftNote.length > 0 ? trimmedDraftNote : (sourceNote ?? "").trim(),
    canShowLargePreview,
    expandedPreviewUrl,
    youtubeEmbedUrl,
    isPortraitYouTubeEmbed,
    spotifyEmbedUrl,
    spotifyEmbedHeight,
    activeProvider,
    externalEmbedUrl,
    externalEmbedType,
    externalSourceKind,
    soundCloudEmbedHeight,
    externalIframeClassName,
    externalIframeStyle,
    externalPreviewNote,
    shouldShowGenericUnfurlCard,
    resolvedThumbnailUrl,
    resolvedExternalSiteName,
    genericUnfurlHost,
    resolvedSourceTitle,
    resolvedExternalDescription,
  };

  const hasUnresolvedDraftIntervalInput =
    shouldValidateIntervals &&
    (parsedDraftStartSec === "invalid" ||
      parsedDraftStartSec === "incomplete" ||
      parsedDraftEndSec === "invalid" ||
      parsedDraftEndSec === "incomplete");
  const shouldBlockSaveForDurationCheck =
    shouldResolveDurationMetadata && isResolvingDurationMetadata;
  const durationResolutionUnavailableMessage =
    shouldResolveDurationMetadata &&
    hasDurationResolutionAttempted &&
    !isResolvingDurationMetadata &&
    resolvedSourceDurationSec === null
      ? "Could not verify clip length right now. If end time is too high, playback stops at clip end."
      : null;
  const inlineValidationMessage = hasInvalidDraftSource
    ? INVALID_ITEM_SOURCE_MESSAGE
    : intervalInvalidReason;
  const inlineHintMessage = !inlineValidationMessage
    ? isCreateFromUrlMode &&
      trimmedDraftUrl.length > 0 &&
      !!parsedDraftSource &&
      isResolvingSourcePreview
      ? "Resolving title and thumbnail..."
      : shouldResolveDurationMetadata && isResolvingDurationMetadata
        ? "Checking clip length..."
        : isUploadingCustomImage
          ? "Uploading image..."
          : durationResolutionUnavailableMessage
    : null;

  const normalizedCurrentUrl = (sourceUrl ?? "").trim();
  const normalizedCurrentNote = (sourceNote ?? "").trim();
  const normalizedCurrentStartSec =
    typeof sourceStartSec === "number" && sourceStartSec >= 0 ? Math.floor(sourceStartSec) : null;
  const normalizedCurrentEndSec =
    typeof sourceEndSec === "number" && sourceEndSec >= 0 ? Math.floor(sourceEndSec) : null;
  const normalizedDraftStartSec =
    parsedDraftStartSec === "invalid" || parsedDraftStartSec === "incomplete"
      ? draftStartSec.trim()
      : parsedDraftStartSec;
  const normalizedDraftEndSec =
    parsedDraftEndSec === "invalid" || parsedDraftEndSec === "incomplete"
      ? draftEndSec.trim()
      : parsedDraftEndSec;
  const hasValidSourceForCreate = trimmedDraftUrl.length > 0 && !!parsedDraftSource;
  const hasLabelChange = resolvedDraftLabel !== normalizeItemLabel(itemLabel);
  const hasImageChange =
    !isCreateFromUrlMode &&
    draftReplacementImageUrl !== null &&
    (selectedImageUrl ?? "").trim().length > 0 &&
    (selectedImageUrl ?? "").trim() !== (itemImageUrl ?? "").trim();
  const hasChanges =
    hasLabelChange ||
    trimmedDraftUrl !== normalizedCurrentUrl ||
    trimmedDraftNote !== normalizedCurrentNote ||
    normalizedDraftStartSec !== normalizedCurrentStartSec ||
    normalizedDraftEndSec !== normalizedCurrentEndSec ||
    hasImageChange;
  const canSave =
    editable &&
    !saving &&
    !isUploadingCustomImage &&
    hasSaveHandler &&
    (isCreateFromUrlMode ? hasValidSourceForCreate && !isResolvingSourcePreview : hasChanges) &&
    !hasInvalidDraftSource &&
    !hasUnresolvedDraftIntervalInput &&
    !shouldBlockSaveForDurationCheck &&
    !intervalInvalidReason;

  return {
    isCreateFromUrlMode,
    trimmedDraftUrl,
    trimmedDraftNote,
    parsedDraftSource,
    activeParsedSource,
    activeSourceUrl,
    activeProvider,
    hasSource,
    hasInvalidDraftSource,
    shouldValidateIntervals,
    shouldResolveDurationMetadata,
    parsedDraftStartSec,
    parsedDraftEndSec,
    resolvedDurationLabel,
    resolvedSourceTitle,
    intervalInvalidReason,
    resolvedPreviewTitle,
    fallbackCreateLabel,
    resolvedDraftLabel,
    previewItemLabel,
    previewImageUrl,
    selectedImageUrl,
    previewPanelModel,
    youtubeEmbedUrl,
    isPortraitYouTubeEmbed,
    spotifyEmbedUrl,
    spotifyEmbedHeight,
    externalSourceKind,
    externalSourceLabel,
    externalEmbedUrl,
    externalEmbedType,
    soundCloudEmbedHeight,
    canShowLargePreview,
    expandedPreviewUrl,
    externalIframeClassName,
    externalIframeStyle,
    externalPreviewNote,
    shouldShowGenericUnfurlCard,
    resolvedThumbnailUrl,
    resolvedExternalSiteName,
    genericUnfurlHost,
    resolvedExternalDescription,
    inlineValidationMessage,
    inlineHintMessage,
    hasValidSourceForCreate,
    hasLabelChange,
    hasImageChange,
    canSave,
    isResolvingSourcePreview,
  };
}
