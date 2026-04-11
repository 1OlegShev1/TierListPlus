"use client";

import { ExternalLink, Maximize2 } from "lucide-react";
import { useState } from "react";
import type { SourcePreviewPanelModel } from "@/components/items/source-modal/types";
import { Button } from "@/components/ui/Button";
import { ItemArtwork } from "@/components/ui/ItemArtwork";

interface SourcePreviewPanelProps {
  model: SourcePreviewPanelModel;
}

export function SourcePreviewPanel({ model }: SourcePreviewPanelProps) {
  const {
    hasSource,
    activeSourceUrl,
    hasInvalidDraftSource,
    isCreateFromUrlMode,
    previewImageUrl,
    previewItemLabel,
    externalSourceLabel,
    displayNote,
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
  } = model;
  const [showExpandedPreview, setShowExpandedPreview] = useState(false);

  return (
    <>
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
                  presentation="ambient"
                  inset="tight"
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
                {displayNote && <p className="text-sm text-[var(--fg-secondary)]">{displayNote}</p>}
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

            {shouldShowGenericUnfurlCard && (
              <a
                href={activeSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] transition-colors hover:border-[var(--border-strong)]"
              >
                {resolvedThumbnailUrl && (
                  <div className="max-h-56 overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
                    <img
                      src={resolvedThumbnailUrl}
                      alt={`${previewItemLabel} link preview`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}
                <div className="space-y-1.5 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--fg-subtle)]">
                    {resolvedExternalSiteName ?? genericUnfurlHost ?? "External link"}
                  </p>
                  <p className="text-sm font-semibold text-[var(--fg-primary)]">
                    {resolvedSourceTitle ?? previewItemLabel}
                  </p>
                  {resolvedExternalDescription && (
                    <p className="text-sm text-[var(--fg-secondary)]">
                      {resolvedExternalDescription}
                    </p>
                  )}
                </div>
              </a>
            )}

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
    </>
  );
}
