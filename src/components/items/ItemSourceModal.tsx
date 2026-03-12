"use client";

import { ExternalLink, Maximize2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ImageUploader,
  type ImageUploaderHandle,
  type UploadedImage,
} from "@/components/shared/ImageUploader";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { Textarea } from "@/components/ui/Textarea";
import { tryCleanupUnattachedUpload } from "@/lib/api-client";
import {
  buildExternalSourceEmbedUrl,
  buildYouTubeEmbedUrl,
  detectExternalSourceKind,
  type ExternalSourceKind,
  getExternalSourceCapability,
  getExternalSourceKindLabel,
  getItemSourceProviderLabel,
  INVALID_ITEM_SOURCE_MESSAGE,
  MAX_ITEM_LABEL_LENGTH,
  MAX_SOURCE_INTERVAL_SECONDS,
  normalizeItemLabel,
  parseAnyItemSource,
  resolveItemImageUrlForWrite,
  suggestItemLabelFromSourceUrl,
} from "@/lib/item-source";
import { extractManagedUploadFilename } from "@/lib/uploads";
import type { ItemSourceProvider } from "@/types";

type ItemSourceModalMode = "EDIT_SOURCE" | "CREATE_FROM_URL";

interface ItemSourceModalProps {
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

function parseOptionalTimeToSeconds(value: string): number | null | "incomplete" | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_SOURCE_INTERVAL_SECONDS) {
      return "invalid";
    }
    return parsed;
  }

  if (!/^\d+(?::\d*){1,2}$/.test(trimmed)) return "invalid";
  if (trimmed.endsWith(":")) return "incomplete";
  const segmentsRaw = trimmed.split(":");
  if (segmentsRaw.some((segment) => segment.length === 0)) return "incomplete";

  const segments = segmentsRaw.map((segment) => Number.parseInt(segment, 10));
  if (segments.some((segment) => !Number.isFinite(segment) || segment < 0)) return "invalid";

  let totalSeconds = 0;
  if (segments.length === 2) {
    const [minutes, seconds] = segments;
    if (seconds > 59) return "invalid";
    totalSeconds = minutes * 60 + seconds;
  } else if (segments.length === 3) {
    const [hours, minutes, seconds] = segments;
    if (minutes > 59 || seconds > 59) return "invalid";
    totalSeconds = hours * 3600 + minutes * 60 + seconds;
  } else {
    return "invalid";
  }

  if (totalSeconds > MAX_SOURCE_INTERVAL_SECONDS) return "invalid";
  return totalSeconds;
}

function formatIntervalInputValue(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || seconds < 0) return "";
  const normalized = Math.floor(seconds);
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const remainderSeconds = normalized % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainderSeconds).padStart(2, "0")}`;
  }
  if (minutes > 0) {
    return `${minutes}:${String(remainderSeconds).padStart(2, "0")}`;
  }
  return String(remainderSeconds);
}

function formatDurationLabel(seconds: number | null): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return formatIntervalInputValue(seconds);
}

function isTwitchClipSourceUrl(sourceUrl: string | null | undefined): boolean {
  if (!sourceUrl) return false;
  try {
    const parsed = new URL(sourceUrl);
    const host = parsed.hostname.toLowerCase();
    if (host === "clips.twitch.tv") return true;
    const segments = parsed.pathname.split("/").filter(Boolean);
    return (segments[0] === "clip" && !!segments[1]) || (segments[1] === "clip" && !!segments[2]);
  } catch {
    return false;
  }
}

type ResolvedExternalPreview = {
  kind: ExternalSourceKind | null;
  label: string;
  embedUrl: string | null;
  embedType: "iframe" | "image" | "video" | "audio" | null;
  note: string | null;
};

type SourcePreviewResolutionPayload = ResolvedExternalPreview & {
  provider: ItemSourceProvider | null;
  youtubeContentKind: "VIDEO" | "SHORTS" | null;
  durationSec: number | null;
  thumbnailUrl: string | null;
  title: string | null;
};

const FILE_PICKER_CANCEL_GUARD_MS = 500;

export function ItemSourceModal({
  open,
  mode = "EDIT_SOURCE",
  itemLabel,
  itemImageUrl = null,
  sourceUrl,
  sourceProvider,
  sourceNote,
  sourceStartSec,
  sourceEndSec,
  editable,
  saving = false,
  error = null,
  onClose,
  onSave,
}: ItemSourceModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const cardImageUploaderRef = useRef<ImageUploaderHandle>(null);
  const isSelectingImageRef = useRef(false);
  const imagePickerCancelGuardUntilRef = useRef(0);
  const imagePickerSafetyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewResolveRequestIdRef = useRef(0);
  const durationResolveRequestIdRef = useRef(0);
  const pendingUploadedImageUrlsRef = useRef<Set<string>>(new Set());
  const [draftUrl, setDraftUrl] = useState(sourceUrl ?? "");
  const [draftLabel, setDraftLabel] = useState(itemLabel);
  const [draftLabelTouched, setDraftLabelTouched] = useState(false);
  const [draftNote, setDraftNote] = useState(sourceNote ?? "");
  const [draftStartSec, setDraftStartSec] = useState(formatIntervalInputValue(sourceStartSec));
  const [draftEndSec, setDraftEndSec] = useState(formatIntervalInputValue(sourceEndSec));
  const [draftReplacementImageUrl, setDraftReplacementImageUrl] = useState<string | null>(null);
  const [isUploadingCustomImage, setIsUploadingCustomImage] = useState(false);
  const [embedParentHostname, setEmbedParentHostname] = useState("");
  const [resolvedExternalPreview, setResolvedExternalPreview] =
    useState<ResolvedExternalPreview | null>(null);
  const [resolvedYouTubeContentKind, setResolvedYouTubeContentKind] = useState<
    "VIDEO" | "SHORTS" | null
  >(null);
  const [resolvedThumbnailUrl, setResolvedThumbnailUrl] = useState<string | null>(null);
  const [resolvedSourceTitle, setResolvedSourceTitle] = useState<string | null>(null);
  const [resolvedSourceDurationSec, setResolvedSourceDurationSec] = useState<number | null>(null);
  const [isResolvingSourcePreview, setIsResolvingSourcePreview] = useState(false);
  const [isResolvingDurationMetadata, setIsResolvingDurationMetadata] = useState(false);
  const [hasDurationResolutionAttempted, setHasDurationResolutionAttempted] = useState(false);
  const [showExpandedPreview, setShowExpandedPreview] = useState(false);

  const cleanupPendingUploadedImage = useCallback((imageUrl: string, context: string) => {
    if (!extractManagedUploadFilename(imageUrl)) return;
    void tryCleanupUnattachedUpload(imageUrl, context);
  }, []);

  const cleanupPendingUploadedImages = useCallback(
    (context: string) => {
      const pendingUrls = [...pendingUploadedImageUrlsRef.current];
      pendingUploadedImageUrlsRef.current.clear();
      for (const imageUrl of pendingUrls) {
        cleanupPendingUploadedImage(imageUrl, context);
      }
    },
    [cleanupPendingUploadedImage],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEmbedParentHostname(window.location.hostname);
  }, []);

  useEffect(() => {
    if (!open) return;
    setDraftUrl(sourceUrl ?? "");
    setDraftLabel(itemLabel);
    setDraftLabelTouched(false);
    setDraftNote(sourceNote ?? "");
    setDraftStartSec(formatIntervalInputValue(sourceStartSec));
    setDraftEndSec(formatIntervalInputValue(sourceEndSec));
    setDraftReplacementImageUrl(null);
    setIsUploadingCustomImage(false);
    isSelectingImageRef.current = false;
    imagePickerCancelGuardUntilRef.current = 0;
    if (imagePickerSafetyResetTimeoutRef.current) {
      clearTimeout(imagePickerSafetyResetTimeoutRef.current);
      imagePickerSafetyResetTimeoutRef.current = null;
    }
    setShowExpandedPreview(false);
  }, [itemLabel, open, sourceEndSec, sourceNote, sourceStartSec, sourceUrl]);

  useEffect(() => {
    return () => {
      if (imagePickerSafetyResetTimeoutRef.current) {
        clearTimeout(imagePickerSafetyResetTimeoutRef.current);
      }
      cleanupPendingUploadedImages("item source modal unmount");
    };
  }, [cleanupPendingUploadedImages]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      if (editable) {
        setTimeout(() => sourceInputRef.current?.focus(), 0);
      }
      return;
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [editable, open]);

  const trimmedDraftUrl = draftUrl.trim();
  const trimmedDraftNote = draftNote.trim();

  const parsedSavedSource = useMemo(() => {
    if (!sourceUrl) return null;
    return parseAnyItemSource(sourceUrl);
  }, [sourceUrl]);

  const parsedDraftSource = useMemo(() => {
    if (!trimmedDraftUrl) return null;
    return parseAnyItemSource(trimmedDraftUrl);
  }, [trimmedDraftUrl]);

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

  const displayNote = trimmedDraftNote.length > 0 ? trimmedDraftNote : (sourceNote ?? "").trim();
  const parsedDraftStartSec = parseOptionalTimeToSeconds(draftStartSec);
  const parsedDraftEndSec = parseOptionalTimeToSeconds(draftEndSec);
  const resolvedDurationLabel = formatDurationLabel(resolvedSourceDurationSec);
  const hasInvalidDraftIntervalInput =
    parsedDraftStartSec === "invalid" || parsedDraftEndSec === "invalid";
  const hasIncompleteDraftIntervalInput =
    parsedDraftStartSec === "incomplete" || parsedDraftEndSec === "incomplete";
  const hasUnresolvedDraftIntervalInput =
    shouldValidateIntervals && (hasInvalidDraftIntervalInput || hasIncompleteDraftIntervalInput);
  const shouldBlockSaveForDurationCheck =
    shouldResolveDurationMetadata && isResolvingDurationMetadata;
  const durationResolutionUnavailableMessage =
    shouldResolveDurationMetadata &&
    hasDurationResolutionAttempted &&
    !isResolvingDurationMetadata &&
    resolvedSourceDurationSec === null
      ? "Could not verify clip length right now. If end time is too high, playback stops at clip end."
      : null;
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
  const resolvedStartSec = shouldValidateIntervals
    ? parsedDraftStartSec === "invalid" || parsedDraftStartSec === "incomplete"
      ? (sourceStartSec ?? null)
      : (parsedDraftStartSec ?? sourceStartSec ?? null)
    : null;
  const resolvedEndSec = shouldValidateIntervals
    ? parsedDraftEndSec === "invalid" || parsedDraftEndSec === "incomplete"
      ? (sourceEndSec ?? null)
      : (parsedDraftEndSec ?? sourceEndSec ?? null)
    : null;
  const youtubeEmbedUrl =
    activeParsedSource?.provider === "YOUTUBE" && activeParsedSource.youtubeVideoId
      ? buildYouTubeEmbedUrl(
          activeParsedSource.youtubeVideoId,
          resolvedStartSec ?? null,
          resolvedEndSec ?? null,
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
  const fallbackExternalKind =
    activeProvider === null ? detectExternalSourceKind(activeSourceUrl) : null;
  const fallbackExternalCapability = getExternalSourceCapability(fallbackExternalKind);
  const fallbackExternalEmbedUrl =
    activeProvider === null
      ? buildExternalSourceEmbedUrl(activeSourceUrl, embedParentHostname)
      : null;
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
  const externalIframeClassName = isPortraitExternalEmbed
    ? "w-full"
    : compactExternalIframeHeight
      ? "w-full"
      : "aspect-video w-full";
  const externalIframeStyle = isPortraitExternalEmbed
    ? { height: "min(52dvh, 30rem)" }
    : compactExternalIframeHeight
      ? { height: compactExternalIframeHeight }
      : undefined;
  const externalPreviewNote =
    resolvedExternalPreview?.note ??
    (!externalEmbedUrl ? (fallbackExternalCapability?.fallbackNote ?? null) : null);
  const isCreateFromUrlMode = mode === "CREATE_FROM_URL";
  const resolvedPreviewTitle = isCreateFromUrlMode ? normalizeItemLabel(resolvedSourceTitle) : "";
  const suggestedLabelFromUrl = useMemo(() => {
    if (!isCreateFromUrlMode || !activeSourceUrl) return "";
    return suggestItemLabelFromSourceUrl(activeSourceUrl);
  }, [activeSourceUrl, isCreateFromUrlMode]);
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

  useEffect(() => {
    const requestId = ++previewResolveRequestIdRef.current;
    setResolvedExternalPreview(null);
    setResolvedYouTubeContentKind(null);
    setResolvedThumbnailUrl(null);
    setResolvedSourceTitle(null);
    setIsResolvingSourcePreview(false);
    if (!activeSourceUrl) return;
    const shouldResolveExternal =
      activeProvider === null &&
      fallbackExternalCapability?.previewMode === "RESOLVER" &&
      !fallbackExternalEmbedUrl;
    const shouldResolveYouTubeMetadata =
      activeProvider === "YOUTUBE" && activeParsedSource?.provider === "YOUTUBE";
    const shouldResolveCreateMetadata = isCreateFromUrlMode;
    if (!shouldResolveExternal && !shouldResolveYouTubeMetadata && !shouldResolveCreateMetadata) {
      return;
    }
    if (shouldResolveCreateMetadata) {
      setIsResolvingSourcePreview(true);
    }

    const controller = new AbortController();
    const resolveTimeout = setTimeout(() => controller.abort(), 5_000);
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({ url: activeSourceUrl });
      if (embedParentHostname) {
        params.set("parent", embedParentHostname);
      }
      void fetch(`/api/sources/resolve?${params.toString()}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok || previewResolveRequestIdRef.current !== requestId) return;
          const payload = (await response.json()) as SourcePreviewResolutionPayload;
          if (previewResolveRequestIdRef.current !== requestId) return;
          setResolvedThumbnailUrl(payload.thumbnailUrl ?? null);
          setResolvedSourceTitle(payload.title ?? null);
          if (payload.provider === "YOUTUBE") {
            setResolvedYouTubeContentKind(payload.youtubeContentKind ?? null);
            return;
          }
          setResolvedExternalPreview(payload);
        })
        .catch(() => {
          // Keep client fallback metadata and open-source behavior.
        })
        .finally(() => {
          clearTimeout(resolveTimeout);
          if (previewResolveRequestIdRef.current !== requestId) return;
          if (shouldResolveCreateMetadata) {
            setIsResolvingSourcePreview(false);
          }
        });
    }, 200);

    return () => {
      clearTimeout(timeout);
      clearTimeout(resolveTimeout);
      controller.abort();
    };
  }, [
    activeProvider,
    activeParsedSource,
    activeSourceUrl,
    embedParentHostname,
    fallbackExternalCapability?.previewMode,
    fallbackExternalEmbedUrl,
    isCreateFromUrlMode,
  ]);

  useEffect(() => {
    const requestId = ++durationResolveRequestIdRef.current;
    setResolvedSourceDurationSec(null);
    setIsResolvingDurationMetadata(false);
    setHasDurationResolutionAttempted(false);
    if (
      !activeSourceUrl ||
      !shouldResolveDurationMetadata ||
      activeProvider !== "YOUTUBE" ||
      activeParsedSource?.provider !== "YOUTUBE"
    ) {
      return;
    }

    setIsResolvingDurationMetadata(true);
    const controller = new AbortController();
    const resolveTimeout = setTimeout(() => controller.abort(), 5_000);
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({ url: activeSourceUrl, includeDuration: "1" });
      if (embedParentHostname) {
        params.set("parent", embedParentHostname);
      }
      void fetch(`/api/sources/resolve?${params.toString()}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok || durationResolveRequestIdRef.current !== requestId) return;
          const payload = (await response.json()) as SourcePreviewResolutionPayload;
          if (durationResolveRequestIdRef.current !== requestId) return;
          setResolvedSourceDurationSec(
            typeof payload.durationSec === "number" && payload.durationSec > 0
              ? Math.floor(payload.durationSec)
              : null,
          );
        })
        .catch(() => {
          // Keep fallback behavior; save should still be possible when duration is unknown.
        })
        .finally(() => {
          clearTimeout(resolveTimeout);
          if (durationResolveRequestIdRef.current !== requestId) return;
          setIsResolvingDurationMetadata(false);
          setHasDurationResolutionAttempted(true);
        });
    }, 200);

    return () => {
      clearTimeout(timeout);
      clearTimeout(resolveTimeout);
      controller.abort();
    };
  }, [
    activeParsedSource,
    activeProvider,
    activeSourceUrl,
    embedParentHostname,
    shouldResolveDurationMetadata,
  ]);

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
  const inlineValidationMessage = hasInvalidDraftSource
    ? INVALID_ITEM_SOURCE_MESSAGE
    : intervalInvalidReason;
  const hasValidSourceForCreate = trimmedDraftUrl.length > 0 && !!parsedDraftSource;
  const createResolvingHint =
    isCreateFromUrlMode && hasValidSourceForCreate && isResolvingSourcePreview
      ? "Resolving title and thumbnail..."
      : null;
  const durationResolvingHint =
    shouldResolveDurationMetadata && isResolvingDurationMetadata ? "Checking clip length..." : null;
  const imageUploadingHint = isUploadingCustomImage ? "Uploading image..." : null;
  const inlineHintMessage =
    !inlineValidationMessage &&
    (createResolvingHint ??
      durationResolvingHint ??
      imageUploadingHint ??
      durationResolutionUnavailableMessage);
  const normalizedCurrentLabel = normalizeItemLabel(itemLabel);
  const hasLabelChange = resolvedDraftLabel !== normalizedCurrentLabel;
  const normalizedCurrentImageUrl = (itemImageUrl ?? "").trim();
  const normalizedSelectedImageUrl = (selectedImageUrl ?? "").trim();
  const hasImageChange =
    !isCreateFromUrlMode &&
    draftReplacementImageUrl !== null &&
    normalizedSelectedImageUrl.length > 0 &&
    normalizedSelectedImageUrl !== normalizedCurrentImageUrl;
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
    !!onSave &&
    (isCreateFromUrlMode ? hasValidSourceForCreate && !isResolvingSourcePreview : hasChanges) &&
    !hasInvalidDraftSource &&
    !hasUnresolvedDraftIntervalInput &&
    !shouldBlockSaveForDurationCheck &&
    !intervalInvalidReason;

  useEffect(() => {
    if (!isCreateFromUrlMode || draftLabelTouched) return;
    setDraftLabel(fallbackCreateLabel);
  }, [draftLabelTouched, fallbackCreateLabel, isCreateFromUrlMode]);

  const releasePendingUploadedImage = useCallback(
    (imageUrl: string | null, context: string) => {
      if (!imageUrl) return;
      if (!pendingUploadedImageUrlsRef.current.delete(imageUrl)) return;
      cleanupPendingUploadedImage(imageUrl, context);
    },
    [cleanupPendingUploadedImage],
  );

  const handleCustomImageUploaded = ({ url }: UploadedImage) => {
    isSelectingImageRef.current = false;
    imagePickerCancelGuardUntilRef.current = 0;
    if (imagePickerSafetyResetTimeoutRef.current) {
      clearTimeout(imagePickerSafetyResetTimeoutRef.current);
      imagePickerSafetyResetTimeoutRef.current = null;
    }
    if (draftReplacementImageUrl && draftReplacementImageUrl !== url) {
      releasePendingUploadedImage(draftReplacementImageUrl, "item source custom image replaced");
    }
    pendingUploadedImageUrlsRef.current.add(url);
    setDraftReplacementImageUrl(url);
  };

  const openImageFilePicker = () => {
    if (saving || isUploadingCustomImage) return;
    isSelectingImageRef.current = true;
    imagePickerCancelGuardUntilRef.current = Date.now() + FILE_PICKER_CANCEL_GUARD_MS;
    if (typeof window !== "undefined") {
      const handleWindowFocus = () => {
        imagePickerCancelGuardUntilRef.current = Date.now() + FILE_PICKER_CANCEL_GUARD_MS;
        setTimeout(() => {
          isSelectingImageRef.current = false;
        }, FILE_PICKER_CANCEL_GUARD_MS);
      };
      window.addEventListener("focus", handleWindowFocus, { once: true, capture: true });
    }
    if (imagePickerSafetyResetTimeoutRef.current) {
      clearTimeout(imagePickerSafetyResetTimeoutRef.current);
    }
    imagePickerSafetyResetTimeoutRef.current = setTimeout(() => {
      isSelectingImageRef.current = false;
      imagePickerCancelGuardUntilRef.current = 0;
      imagePickerSafetyResetTimeoutRef.current = null;
    }, 15_000);
    cardImageUploaderRef.current?.openFilePicker();
  };

  const isWithinImagePickerCancelGuard = () =>
    isSelectingImageRef.current || Date.now() < imagePickerCancelGuardUntilRef.current;

  const reopenDialogIfNeeded = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open || !open) return;
    dialog.showModal();
  };

  const close = () => {
    if (saving || isUploadingCustomImage) return;
    cleanupPendingUploadedImages("item source modal close");
    onClose();
  };

  const save = async () => {
    if (!canSave || !onSave) return;
    const payload: Parameters<NonNullable<typeof onSave>>[0] = {
      sourceUrl: trimmedDraftUrl.length > 0 ? trimmedDraftUrl : null,
      sourceNote:
        trimmedDraftUrl.length > 0 && trimmedDraftNote.length > 0 ? trimmedDraftNote : null,
      sourceStartSec:
        shouldValidateIntervals && typeof parsedDraftStartSec === "number"
          ? parsedDraftStartSec
          : null,
      sourceEndSec:
        shouldValidateIntervals && typeof parsedDraftEndSec === "number" ? parsedDraftEndSec : null,
    };
    const nextResolvedImageUrl = normalizedSelectedImageUrl || null;
    if (isCreateFromUrlMode) {
      payload.itemLabel = resolvedDraftLabel || fallbackCreateLabel;
      payload.resolvedImageUrl = nextResolvedImageUrl;
      payload.resolvedTitle = resolvedPreviewTitle || null;
    } else {
      if (hasLabelChange) {
        payload.itemLabel = resolvedDraftLabel;
      }
      if (hasImageChange && nextResolvedImageUrl) {
        payload.resolvedImageUrl = nextResolvedImageUrl;
      }
    }
    const succeeded = await onSave(payload);

    if (succeeded) {
      if (payload.resolvedImageUrl) {
        pendingUploadedImageUrlsRef.current.delete(payload.resolvedImageUrl);
      }
      cleanupPendingUploadedImages("item source modal save");
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        if (isWithinImagePickerCancelGuard()) {
          event.preventDefault();
          reopenDialogIfNeeded();
          return;
        }
        if (saving || isUploadingCustomImage) {
          event.preventDefault();
          return;
        }
        close();
      }}
      onClose={() => {
        if (isWithinImagePickerCancelGuard()) {
          reopenDialogIfNeeded();
          return;
        }
        if (!open) return;
        if (!saving && !isUploadingCustomImage) {
          close();
        }
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),34rem)] overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-left text-[var(--fg-primary)] shadow-2xl shadow-black/60 backdrop:bg-[var(--bg-overlay)] focus:outline-none sm:p-6"
    >
      <h2 className="text-lg font-bold">
        {isCreateFromUrlMode ? "Add Item via URL" : "Item Source"}
      </h2>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">
        {isCreateFromUrlMode ? (
          <>
            Paste a URL to create{" "}
            <span className="font-medium text-[var(--fg-secondary)]">{itemLabel}</span>. The
            resolved thumbnail (or media fallback) is the default item image, and you can override
            it.
          </>
        ) : (
          <>
            Add a source link for{" "}
            <span className="font-medium text-[var(--fg-secondary)]">{itemLabel}</span>.
          </>
        )}
      </p>

      <div className="mt-5 space-y-4">
        {editable ? (
          <>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--fg-secondary)]">
                {isCreateFromUrlMode ? "Item URL" : "Source URL"}
              </span>
              <Input
                ref={sourceInputRef}
                type="url"
                placeholder="https://example.com (YouTube, Spotify, Vimeo, SoundCloud, Twitch, and direct media can preview)"
                value={draftUrl}
                onChange={(event) => setDraftUrl(event.target.value)}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                disabled={saving}
                className="w-full"
              />
            </label>
            <p className="text-xs text-[var(--fg-subtle)]">
              External previews may contact third-party platforms and are subject to their terms and
              privacy policies.
            </p>

            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
              <div className="flex items-start gap-3">
                <div className="group relative h-24 w-24 flex-shrink-0 overflow-hidden rounded border border-[var(--border-default)] bg-[var(--bg-surface)]">
                  {previewImageUrl ? (
                    <ItemArtwork
                      src={previewImageUrl}
                      alt={previewItemLabel || "Item image"}
                      className="h-full w-full"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-[var(--fg-subtle)]">
                      No image
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={openImageFilePicker}
                    disabled={saving || isUploadingCustomImage}
                    aria-label="Replace"
                    className="absolute inset-x-1 bottom-1 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1 text-[9px] font-medium leading-tight text-[var(--fg-secondary)] opacity-100 transition-all hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--fg-primary)] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 disabled:cursor-default disabled:opacity-60"
                  >
                    Replace
                  </button>
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-[var(--fg-secondary)]">
                      Item label
                    </span>
                    <Input
                      type="text"
                      placeholder="e.g. The Miracle"
                      value={draftLabel}
                      onChange={(event) => {
                        setDraftLabel(event.target.value);
                        setDraftLabelTouched(true);
                      }}
                      maxLength={MAX_ITEM_LABEL_LENGTH}
                      disabled={saving}
                      className="w-full"
                    />
                  </label>
                </div>
              </div>
              <ImageUploader
                ref={cardImageUploaderRef}
                onUploaded={handleCustomImageUploaded}
                onUploadStateChange={setIsUploadingCustomImage}
                disabled={saving}
                className="hidden"
              />
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--fg-secondary)]">
                {isCreateFromUrlMode ? "Description (optional)" : "Source Note (optional)"}
              </span>
              <Textarea
                value={draftNote}
                onChange={(event) => setDraftNote(event.target.value)}
                maxLength={120}
                rows={2}
                disabled={saving}
                placeholder={
                  isCreateFromUrlMode
                    ? "Short context for voters (optional)"
                    : "Official audio, live version, remix, etc."
                }
                className="w-full"
              />
            </label>
            {activeParsedSource?.provider === "YOUTUBE" && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-[var(--fg-secondary)]">
                      Start time
                    </span>
                    <Input
                      type="text"
                      inputMode="text"
                      placeholder="e.g. 1:30"
                      value={draftStartSec}
                      onChange={(event) => setDraftStartSec(event.target.value)}
                      disabled={saving}
                      className="w-full"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-[var(--fg-secondary)]">End time</span>
                    <Input
                      type="text"
                      inputMode="text"
                      placeholder="e.g. 2:15"
                      value={draftEndSec}
                      onChange={(event) => setDraftEndSec(event.target.value)}
                      disabled={saving}
                      className="w-full"
                    />
                  </label>
                </div>
                <p className="text-xs text-[var(--fg-subtle)]">
                  Examples: 90, 1:30, 1:02:30.{" "}
                  {resolvedDurationLabel
                    ? `Clip length: ${resolvedDurationLabel}.`
                    : "If end exceeds clip length, playback ends naturally."}
                </p>
              </div>
            )}

            <div className="min-h-[3.75rem]" aria-live="polite">
              {inlineValidationMessage ? (
                <ErrorMessage message={inlineValidationMessage} />
              ) : inlineHintMessage ? (
                <p className="text-xs text-[var(--fg-subtle)]">{inlineHintMessage}</p>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
          {hasSource && activeSourceUrl ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                {previewImageUrl ? (
                  <ItemArtwork
                    src={previewImageUrl}
                    alt="Source preview"
                    className="h-16 w-24 flex-shrink-0 rounded"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--fg-secondary)]">
                    {externalSourceLabel}
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-[var(--fg-subtle)]">
                    {externalSourceLabel}
                  </p>
                  <p className="truncate text-sm font-medium text-[var(--fg-primary)]">
                    {previewItemLabel}
                  </p>
                  {displayNote && (
                    <p className="text-sm text-[var(--fg-secondary)]">{displayNote}</p>
                  )}
                  <p className="truncate text-xs text-[var(--fg-subtle)]">{activeSourceUrl}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={activeSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-2.5 py-1.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Open source
                </a>
                {canShowLargePreview && (
                  <button
                    type="button"
                    onClick={() => setShowExpandedPreview(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] px-2.5 py-1.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                  >
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Large preview
                  </button>
                )}
              </div>
              {youtubeEmbedUrl && (
                <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
                  {isPortraitYouTubeEmbed ? (
                    <div className="bg-[var(--bg-canvas)] p-2">
                      <iframe
                        src={youtubeEmbedUrl}
                        title={`${previewItemLabel} YouTube Shorts preview`}
                        className="w-full"
                        style={{ height: "min(52dvh, 30rem)" }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <iframe
                      src={youtubeEmbedUrl}
                      title={`${previewItemLabel} YouTube preview`}
                      className="aspect-video w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  )}
                </div>
              )}
              {spotifyEmbedUrl && (
                <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
                  <iframe
                    src={spotifyEmbedUrl}
                    title={`${previewItemLabel} Spotify preview`}
                    className="w-full"
                    style={{ height: spotifyEmbedHeight }}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                  />
                </div>
              )}
              {activeProvider === null && externalEmbedUrl && (
                <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
                  {externalEmbedType === "image" ? (
                    <img
                      src={externalEmbedUrl}
                      alt={`${previewItemLabel} source preview`}
                      className="max-h-[28rem] w-full object-contain"
                    />
                  ) : externalEmbedType === "video" ? (
                    // biome-ignore lint/a11y/useMediaCaption: External direct-media URLs usually do not ship caption tracks.
                    <video src={externalEmbedUrl} className="max-h-[28rem] w-full" controls />
                  ) : externalEmbedType === "audio" ? (
                    <div className="p-3">
                      {/* biome-ignore lint/a11y/useMediaCaption: External direct-media URLs usually do not ship caption tracks. */}
                      <audio src={externalEmbedUrl} className="w-full" controls />
                    </div>
                  ) : externalSourceKind === "SOUNDCLOUD" ? (
                    <iframe
                      src={externalEmbedUrl}
                      title={`${previewItemLabel} SoundCloud preview`}
                      className="w-full"
                      style={{ height: soundCloudEmbedHeight }}
                      allow="autoplay; encrypted-media"
                      loading="lazy"
                      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-presentation"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="bg-[var(--bg-canvas)] p-2">
                      <iframe
                        src={externalEmbedUrl}
                        title={`${previewItemLabel} source preview`}
                        className={externalIframeClassName}
                        style={externalIframeStyle}
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
                        loading="lazy"
                        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-presentation"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                </div>
              )}
              {activeProvider === null && externalPreviewNote && (
                <p className="text-xs text-[var(--fg-subtle)]">{externalPreviewNote}</p>
              )}
            </div>
          ) : hasInvalidDraftSource ? (
            <p className="text-sm text-[var(--fg-subtle)]">Invalid URL. Use a full http(s) link.</p>
          ) : (
            <p className="text-sm text-[var(--fg-subtle)]">
              {isCreateFromUrlMode
                ? "Paste a URL to preview and add this item."
                : "No source link added yet."}
            </p>
          )}
        </div>

        {error && <ErrorMessage message={error} />}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          onClick={close}
          disabled={saving || isUploadingCustomImage}
          className="w-full sm:w-auto"
        >
          {isCreateFromUrlMode ? "Cancel" : "Close"}
        </Button>
        {editable && (
          <Button onClick={() => void save()} disabled={!canSave} className="w-full sm:w-auto">
            {isCreateFromUrlMode
              ? saving
                ? "Adding..."
                : isResolvingSourcePreview
                  ? "Resolving..."
                  : "Add item"
              : saving
                ? "Saving..."
                : "Save Source"}
          </Button>
        )}
      </div>

      {showExpandedPreview && expandedPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-3">
          <div className="w-[min(calc(100vw-1.5rem),32rem)] rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--fg-primary)]">Large Preview</p>
              <Button
                variant="secondary"
                onClick={() => setShowExpandedPreview(false)}
                className="h-8 px-3 text-xs"
              >
                Close preview
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-1">
              <iframe
                src={expandedPreviewUrl}
                title={`${previewItemLabel} large source preview`}
                className="w-full"
                style={{ height: "min(82dvh, 56rem)" }}
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
                loading="lazy"
                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-presentation"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
