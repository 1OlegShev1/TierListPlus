"use client";

import { ExternalLink, Maximize2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { Textarea } from "@/components/ui/Textarea";
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
  const previewResolveRequestIdRef = useRef(0);
  const durationResolveRequestIdRef = useRef(0);
  const [draftUrl, setDraftUrl] = useState(sourceUrl ?? "");
  const [draftLabel, setDraftLabel] = useState(itemLabel);
  const [draftLabelTouched, setDraftLabelTouched] = useState(false);
  const [draftNote, setDraftNote] = useState(sourceNote ?? "");
  const [draftStartSec, setDraftStartSec] = useState(formatIntervalInputValue(sourceStartSec));
  const [draftEndSec, setDraftEndSec] = useState(formatIntervalInputValue(sourceEndSec));
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
    setShowExpandedPreview(false);
  }, [itemLabel, open, sourceEndSec, sourceNote, sourceStartSec, sourceUrl]);

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
  const previewImageUrl = (() => {
    if (!isCreateFromUrlMode && itemImageUrl) return itemImageUrl;
    if (resolvedThumbnailUrl) return resolvedThumbnailUrl;
    if (!activeSourceUrl) return activeParsedSource?.thumbnailUrl ?? null;
    try {
      return resolveItemImageUrlForWrite(undefined, activeSourceUrl);
    } catch {
      return activeParsedSource?.thumbnailUrl ?? null;
    }
  })();

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
  const inlineHintMessage =
    !inlineValidationMessage &&
    (createResolvingHint ?? durationResolvingHint ?? durationResolutionUnavailableMessage);
  const hasChanges =
    trimmedDraftUrl !== normalizedCurrentUrl ||
    trimmedDraftNote !== normalizedCurrentNote ||
    normalizedDraftStartSec !== normalizedCurrentStartSec ||
    normalizedDraftEndSec !== normalizedCurrentEndSec;
  const canSave =
    editable &&
    !saving &&
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

  const close = () => {
    if (saving) return;
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
    if (isCreateFromUrlMode) {
      payload.itemLabel = resolvedDraftLabel || fallbackCreateLabel;
      payload.resolvedImageUrl = previewImageUrl ?? null;
      payload.resolvedTitle = resolvedPreviewTitle || null;
    }
    const succeeded = await onSave(payload);

    if (succeeded) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        if (saving) {
          event.preventDefault();
          return;
        }
        onClose();
      }}
      onClose={() => {
        if (!saving) {
          onClose();
        }
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),34rem)] overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-left text-white shadow-2xl shadow-black/60 backdrop:bg-black/70 focus:outline-none sm:p-6"
    >
      <h2 className="text-lg font-bold">
        {isCreateFromUrlMode ? "Add Item via URL" : "Item Source"}
      </h2>
      <p className="mt-1 text-sm text-neutral-400">
        {isCreateFromUrlMode ? (
          <>
            Paste a URL to create <span className="font-medium text-neutral-200">{itemLabel}</span>.
            The resolved thumbnail (or media fallback) will be used as item image.
          </>
        ) : (
          <>
            Add a source link for <span className="font-medium text-neutral-200">{itemLabel}</span>.
          </>
        )}
      </p>

      <div className="mt-5 space-y-4">
        {editable ? (
          <>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-neutral-300">
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
            <p className="text-xs text-neutral-500">
              External previews may contact third-party platforms and are subject to their terms and
              privacy policies.
            </p>

            {isCreateFromUrlMode && (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-300">Item label</span>
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
            )}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-neutral-300">
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
                    <span className="text-sm font-medium text-neutral-300">Start time</span>
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
                    <span className="text-sm font-medium text-neutral-300">End time</span>
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
                <p className="text-xs text-neutral-500">
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
                <p className="text-xs text-neutral-500">{inlineHintMessage}</p>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
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
                  <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded border border-neutral-700 bg-neutral-900 text-xs font-semibold text-neutral-200">
                    {externalSourceLabel}
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    {externalSourceLabel}
                  </p>
                  <p className="truncate text-sm font-medium text-neutral-100">
                    {previewItemLabel}
                  </p>
                  {displayNote && <p className="text-sm text-neutral-300">{displayNote}</p>}
                  <p className="truncate text-xs text-neutral-500">{activeSourceUrl}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={activeSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 px-2.5 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:border-amber-400 hover:text-amber-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Open source
                </a>
                {canShowLargePreview && (
                  <button
                    type="button"
                    onClick={() => setShowExpandedPreview(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 px-2.5 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:border-amber-400 hover:text-amber-300"
                  >
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Large preview
                  </button>
                )}
              </div>
              {youtubeEmbedUrl && (
                <div className="overflow-hidden rounded-lg border border-neutral-800 bg-black">
                  {isPortraitYouTubeEmbed ? (
                    <div className="bg-black p-2">
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
                <div className="overflow-hidden rounded-lg border border-neutral-800 bg-black">
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
                <div className="overflow-hidden rounded-lg border border-neutral-800 bg-black">
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
                    <div className="bg-black p-2">
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
                <p className="text-xs text-neutral-500">{externalPreviewNote}</p>
              )}
            </div>
          ) : hasInvalidDraftSource ? (
            <p className="text-sm text-neutral-500">Invalid URL. Use a full http(s) link.</p>
          ) : (
            <p className="text-sm text-neutral-500">
              {isCreateFromUrlMode
                ? "Paste a URL to preview and add this item."
                : "No source link added yet."}
            </p>
          )}
        </div>

        {error && <ErrorMessage message={error} />}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={close} disabled={saving} className="w-full sm:w-auto">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3">
          <div className="w-[min(calc(100vw-1.5rem),32rem)] rounded-xl border border-neutral-700 bg-neutral-900 p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-neutral-100">Large Preview</p>
              <Button
                variant="secondary"
                onClick={() => setShowExpandedPreview(false)}
                className="h-8 px-3 text-xs"
              >
                Close preview
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border border-neutral-800 bg-black p-1">
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
