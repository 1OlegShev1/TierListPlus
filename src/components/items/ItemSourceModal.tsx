"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  buildYouTubeEmbedUrl,
  getItemSourceProviderLabel,
  MAX_SOURCE_INTERVAL_SECONDS,
  parseSupportedItemSource,
  UNSUPPORTED_ITEM_SOURCE_MESSAGE,
} from "@/lib/item-source";
import type { ItemSourceProvider } from "@/types";

interface ItemSourceModalProps {
  open: boolean;
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
  }) => Promise<boolean>;
}

function parseOptionalPositiveInt(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return "invalid";
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_SOURCE_INTERVAL_SECONDS) {
    return "invalid";
  }
  return parsed;
}

export function ItemSourceModal({
  open,
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
  const [draftUrl, setDraftUrl] = useState(sourceUrl ?? "");
  const [draftNote, setDraftNote] = useState(sourceNote ?? "");
  const [draftStartSec, setDraftStartSec] = useState(
    typeof sourceStartSec === "number" ? String(sourceStartSec) : "",
  );
  const [draftEndSec, setDraftEndSec] = useState(
    typeof sourceEndSec === "number" ? String(sourceEndSec) : "",
  );

  useEffect(() => {
    if (!open) return;
    setDraftUrl(sourceUrl ?? "");
    setDraftNote(sourceNote ?? "");
    setDraftStartSec(typeof sourceStartSec === "number" ? String(sourceStartSec) : "");
    setDraftEndSec(typeof sourceEndSec === "number" ? String(sourceEndSec) : "");
  }, [open, sourceEndSec, sourceNote, sourceStartSec, sourceUrl]);

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
    return parseSupportedItemSource(sourceUrl);
  }, [sourceUrl]);

  const parsedDraftSource = useMemo(() => {
    if (!trimmedDraftUrl) return null;
    return parseSupportedItemSource(trimmedDraftUrl);
  }, [trimmedDraftUrl]);

  const hasUnsupportedDraftSource = trimmedDraftUrl.length > 0 && !parsedDraftSource;
  const activeParsedSource = trimmedDraftUrl.length > 0 ? parsedDraftSource : parsedSavedSource;
  const activeSourceUrl = activeParsedSource?.normalizedUrl ?? null;
  const activeProvider = activeParsedSource?.provider ?? sourceProvider ?? null;
  const hasSource = !!activeParsedSource;
  const shouldValidateIntervals =
    trimmedDraftUrl.length > 0 && parsedDraftSource?.provider === "YOUTUBE";

  const displayNote = trimmedDraftNote.length > 0 ? trimmedDraftNote : (sourceNote ?? "").trim();
  const parsedDraftStartSec = parseOptionalPositiveInt(draftStartSec);
  const parsedDraftEndSec = parseOptionalPositiveInt(draftEndSec);
  const intervalInvalidReason = shouldValidateIntervals
    ? parsedDraftStartSec === "invalid"
      ? `Start time must be an integer between 0 and ${MAX_SOURCE_INTERVAL_SECONDS}.`
      : parsedDraftEndSec === "invalid"
        ? `End time must be an integer between 0 and ${MAX_SOURCE_INTERVAL_SECONDS}.`
        : typeof parsedDraftStartSec === "number" &&
            typeof parsedDraftEndSec === "number" &&
            parsedDraftEndSec <= parsedDraftStartSec
          ? "End time must be greater than start time."
          : null
    : null;
  const resolvedStartSec = shouldValidateIntervals
    ? parsedDraftStartSec === "invalid"
      ? null
      : (parsedDraftStartSec ?? sourceStartSec ?? null)
    : null;
  const resolvedEndSec = shouldValidateIntervals
    ? parsedDraftEndSec === "invalid"
      ? null
      : (parsedDraftEndSec ?? sourceEndSec ?? null)
    : null;
  const youtubeEmbedUrl =
    activeParsedSource?.provider === "YOUTUBE" && activeParsedSource.youtubeVideoId
      ? buildYouTubeEmbedUrl(
          activeParsedSource.youtubeVideoId,
          resolvedStartSec ?? null,
          resolvedEndSec ?? null,
        )
      : null;
  const spotifyEmbedUrl =
    activeParsedSource?.provider === "SPOTIFY" ? activeParsedSource.embedUrl : null;
  const spotifyEmbedHeight =
    spotifyEmbedUrl && /\/embed\/(track|episode)\//.test(spotifyEmbedUrl) ? 152 : 352;
  const previewImageUrl = itemImageUrl ?? activeParsedSource?.thumbnailUrl ?? null;

  const normalizedCurrentUrl = (sourceUrl ?? "").trim();
  const normalizedCurrentNote = (sourceNote ?? "").trim();
  const normalizedCurrentStartSec =
    typeof sourceStartSec === "number" && sourceStartSec >= 0 ? String(sourceStartSec) : "";
  const normalizedCurrentEndSec =
    typeof sourceEndSec === "number" && sourceEndSec >= 0 ? String(sourceEndSec) : "";
  const hasChanges =
    trimmedDraftUrl !== normalizedCurrentUrl ||
    trimmedDraftNote !== normalizedCurrentNote ||
    draftStartSec.trim() !== normalizedCurrentStartSec ||
    draftEndSec.trim() !== normalizedCurrentEndSec;
  const canSave =
    editable &&
    !saving &&
    !!onSave &&
    hasChanges &&
    !hasUnsupportedDraftSource &&
    !intervalInvalidReason;

  const close = () => {
    if (saving) return;
    onClose();
  };

  const save = async () => {
    if (!canSave || !onSave) return;
    const succeeded = await onSave({
      sourceUrl: trimmedDraftUrl.length > 0 ? trimmedDraftUrl : null,
      sourceNote:
        trimmedDraftUrl.length > 0 && trimmedDraftNote.length > 0 ? trimmedDraftNote : null,
      sourceStartSec:
        shouldValidateIntervals && parsedDraftStartSec !== "invalid" ? parsedDraftStartSec : null,
      sourceEndSec:
        shouldValidateIntervals && parsedDraftEndSec !== "invalid" ? parsedDraftEndSec : null,
    });

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
      <h2 className="text-lg font-bold">Item Source</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Add a Spotify or YouTube link for{" "}
        <span className="font-medium text-neutral-200">{itemLabel}</span>.
      </p>

      <div className="mt-5 space-y-4">
        {editable ? (
          <>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-neutral-300">Source URL</span>
              <Input
                ref={sourceInputRef}
                type="url"
                placeholder="https://open.spotify.com/track/... or https://www.youtube.com/watch?v=..."
                value={draftUrl}
                onChange={(event) => setDraftUrl(event.target.value)}
                disabled={saving}
                className="w-full"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-neutral-300">Source Note (optional)</span>
              <Textarea
                value={draftNote}
                onChange={(event) => setDraftNote(event.target.value)}
                maxLength={120}
                rows={2}
                disabled={saving}
                placeholder="Official audio, live version, remix, etc."
                className="w-full"
              />
            </label>
            {activeParsedSource?.provider === "YOUTUBE" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-neutral-300">Start (sec)</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 30"
                    value={draftStartSec}
                    onChange={(event) => setDraftStartSec(event.target.value)}
                    disabled={saving}
                    className="w-full"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-neutral-300">End (sec)</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 75"
                    value={draftEndSec}
                    onChange={(event) => setDraftEndSec(event.target.value)}
                    disabled={saving}
                    className="w-full"
                  />
                </label>
              </div>
            )}

            {hasUnsupportedDraftSource && (
              <ErrorMessage message={UNSUPPORTED_ITEM_SOURCE_MESSAGE} />
            )}
            {!hasUnsupportedDraftSource && intervalInvalidReason && (
              <ErrorMessage message={intervalInvalidReason} />
            )}
          </>
        ) : null}

        <div className="rounded-lg border border-neutral-800 bg-neutral-950/70 p-3">
          {hasSource && activeSourceUrl ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                {previewImageUrl ? (
                  <img
                    src={previewImageUrl}
                    alt="Source preview"
                    className="h-16 w-24 flex-shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded border border-neutral-700 bg-neutral-900 text-xs font-semibold text-neutral-200">
                    {activeProvider ? getItemSourceProviderLabel(activeProvider) : "Link"}
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    {activeProvider ? getItemSourceProviderLabel(activeProvider) : "External link"}
                  </p>
                  <p className="truncate text-sm font-medium text-neutral-100">{itemLabel}</p>
                  {displayNote && <p className="text-sm text-neutral-300">{displayNote}</p>}
                  <p className="truncate text-xs text-neutral-500">{activeSourceUrl}</p>
                </div>
              </div>

              <a
                href={activeSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md border border-neutral-700 px-2.5 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:border-amber-400 hover:text-amber-300"
              >
                Open source
              </a>
              {youtubeEmbedUrl && (
                <div className="overflow-hidden rounded-lg border border-neutral-800 bg-black">
                  <iframe
                    src={youtubeEmbedUrl}
                    title={`${itemLabel} YouTube preview`}
                    className="aspect-video w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              )}
              {spotifyEmbedUrl && (
                <div className="overflow-hidden rounded-lg border border-neutral-800 bg-black">
                  <iframe
                    src={spotifyEmbedUrl}
                    title={`${itemLabel} Spotify preview`}
                    className="w-full"
                    style={{ height: spotifyEmbedHeight }}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          ) : hasUnsupportedDraftSource ? (
            <p className="text-sm text-neutral-500">
              Unsupported link. Use a Spotify or YouTube URL to show preview and open action.
            </p>
          ) : (
            <p className="text-sm text-neutral-500">No source link added yet.</p>
          )}
        </div>

        {error && <ErrorMessage message={error} />}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={close} disabled={saving} className="w-full sm:w-auto">
          Close
        </Button>
        {editable && (
          <Button onClick={() => void save()} disabled={!canSave} className="w-full sm:w-auto">
            {saving ? "Saving..." : "Save Source"}
          </Button>
        )}
      </div>
    </dialog>
  );
}
