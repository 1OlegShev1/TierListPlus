"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ResolvedExternalPreview,
  SourcePreviewResolutionPayload,
} from "@/components/items/source-modal/types";
import type { ExternalSourceKind, ItemSourceProvider } from "@/lib/item-source";

interface UseSourcePreviewResolutionArgs {
  activeSourceUrl: string | null;
  activeProvider: ItemSourceProvider | null;
  activeParsedSourceProvider: ItemSourceProvider | null | undefined;
  fallbackExternalKind: ExternalSourceKind | null;
  fallbackExternalCapabilityPreviewMode:
    | "INLINE_EMBED"
    | "DIRECT_MEDIA"
    | "RESOLVER"
    | "NONE"
    | null;
  fallbackExternalEmbedUrl: string | null;
  embedParentHostname: string;
  isCreateFromUrlMode: boolean;
  shouldResolveDurationMetadata: boolean;
}

interface SourcePreviewResolutionState {
  resolvedExternalPreview: ResolvedExternalPreview | null;
  resolvedYouTubeContentKind: "VIDEO" | "SHORTS" | null;
  resolvedThumbnailUrl: string | null;
  resolvedSourceTitle: string | null;
  resolvedSourceDescription: string | null;
  resolvedSourceSiteName: string | null;
  resolvedSourceDurationSec: number | null;
  isResolvingSourcePreview: boolean;
  isResolvingDurationMetadata: boolean;
  hasDurationResolutionAttempted: boolean;
}

const INITIAL_RESOLUTION_STATE: SourcePreviewResolutionState = {
  resolvedExternalPreview: null,
  resolvedYouTubeContentKind: null,
  resolvedThumbnailUrl: null,
  resolvedSourceTitle: null,
  resolvedSourceDescription: null,
  resolvedSourceSiteName: null,
  resolvedSourceDurationSec: null,
  isResolvingSourcePreview: false,
  isResolvingDurationMetadata: false,
  hasDurationResolutionAttempted: false,
};

export function useSourcePreviewResolution({
  activeSourceUrl,
  activeProvider,
  activeParsedSourceProvider,
  fallbackExternalKind,
  fallbackExternalCapabilityPreviewMode,
  fallbackExternalEmbedUrl,
  embedParentHostname,
  isCreateFromUrlMode,
  shouldResolveDurationMetadata,
}: UseSourcePreviewResolutionArgs) {
  const requestIdRef = useRef(0);
  const [state, setState] = useState<SourcePreviewResolutionState>(INITIAL_RESOLUTION_STATE);

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    setState(INITIAL_RESOLUTION_STATE);

    if (!activeSourceUrl) return;

    const shouldResolveExternal =
      activeProvider === null &&
      fallbackExternalCapabilityPreviewMode === "RESOLVER" &&
      !fallbackExternalEmbedUrl;
    const shouldResolveGenericUnfurl =
      activeProvider === null && fallbackExternalKind === "GENERIC";
    const shouldResolveYouTubeMetadata =
      activeProvider === "YOUTUBE" && activeParsedSourceProvider === "YOUTUBE";
    const shouldResolveCreateMetadata = isCreateFromUrlMode;
    const shouldFetch =
      shouldResolveExternal ||
      shouldResolveGenericUnfurl ||
      shouldResolveYouTubeMetadata ||
      shouldResolveCreateMetadata ||
      shouldResolveDurationMetadata;

    if (!shouldFetch) return;

    setState((previous) => ({
      ...previous,
      isResolvingSourcePreview: shouldResolveCreateMetadata,
      isResolvingDurationMetadata: shouldResolveDurationMetadata,
    }));

    const controller = new AbortController();
    const resolveTimeout = setTimeout(() => controller.abort(), 5_000);
    const kickoff = setTimeout(() => {
      const params = new URLSearchParams({ url: activeSourceUrl });
      if (embedParentHostname) {
        params.set("parent", embedParentHostname);
      }
      if (shouldResolveDurationMetadata) {
        params.set("includeDuration", "1");
      }

      void fetch(`/api/sources/resolve?${params.toString()}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok || requestIdRef.current !== requestId) return;
          const payload = (await response.json()) as SourcePreviewResolutionPayload;
          if (requestIdRef.current !== requestId) return;

          setState((previous) => ({
            ...previous,
            resolvedThumbnailUrl: payload.thumbnailUrl ?? null,
            resolvedSourceTitle: payload.title ?? null,
            resolvedSourceDescription: payload.description ?? null,
            resolvedSourceSiteName: payload.siteName ?? null,
            resolvedYouTubeContentKind:
              payload.provider === "YOUTUBE" ? (payload.youtubeContentKind ?? null) : null,
            resolvedExternalPreview: payload.provider === "YOUTUBE" ? null : payload,
            resolvedSourceDurationSec: shouldResolveDurationMetadata
              ? typeof payload.durationSec === "number" && payload.durationSec > 0
                ? Math.floor(payload.durationSec)
                : null
              : previous.resolvedSourceDurationSec,
          }));
        })
        .catch(() => {
          // Keep fallback behavior in UI.
        })
        .finally(() => {
          clearTimeout(resolveTimeout);
          if (requestIdRef.current !== requestId) return;
          setState((previous) => ({
            ...previous,
            isResolvingSourcePreview: false,
            isResolvingDurationMetadata: false,
            hasDurationResolutionAttempted:
              shouldResolveDurationMetadata || previous.hasDurationResolutionAttempted,
          }));
        });
    }, 200);

    return () => {
      clearTimeout(kickoff);
      clearTimeout(resolveTimeout);
      controller.abort();
    };
  }, [
    activeParsedSourceProvider,
    activeProvider,
    activeSourceUrl,
    embedParentHostname,
    fallbackExternalCapabilityPreviewMode,
    fallbackExternalEmbedUrl,
    fallbackExternalKind,
    isCreateFromUrlMode,
    shouldResolveDurationMetadata,
  ]);

  return state;
}
