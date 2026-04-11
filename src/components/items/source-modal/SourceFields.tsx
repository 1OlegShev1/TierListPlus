"use client";

import type { RefObject } from "react";
import { SourceIntervalFields } from "@/components/items/source-modal/SourceIntervalFields";
import {
  ImageUploader,
  type ImageUploaderHandle,
  type UploadedImage,
} from "@/components/shared/ImageUploader";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { Textarea } from "@/components/ui/Textarea";
import { MAX_ITEM_LABEL_LENGTH } from "@/lib/item-source";

interface SourceFieldsProps {
  isCreateFromUrlMode: boolean;
  sourceInputRef: RefObject<HTMLInputElement | null>;
  draftUrl: string;
  onDraftUrlChange: (value: string) => void;
  draftLabel: string;
  onDraftLabelChange: (value: string) => void;
  draftNote: string;
  onDraftNoteChange: (value: string) => void;
  previewImageUrl: string | null;
  previewItemLabel: string;
  saving: boolean;
  isUploadingCustomImage: boolean;
  onOpenImageFilePicker: () => void;
  cardImageUploaderRef: RefObject<ImageUploaderHandle | null>;
  onCustomImageUploaded: (image: UploadedImage) => void;
  onUploadStateChange: (uploading: boolean) => void;
  showIntervals: boolean;
  draftStartSec: string;
  draftEndSec: string;
  onDraftStartSecChange: (value: string) => void;
  onDraftEndSecChange: (value: string) => void;
  resolvedDurationLabel: string | null;
  inlineValidationMessage: string | null;
  inlineHintMessage: string | null;
}

export function SourceFields({
  isCreateFromUrlMode,
  sourceInputRef,
  draftUrl,
  onDraftUrlChange,
  draftLabel,
  onDraftLabelChange,
  draftNote,
  onDraftNoteChange,
  previewImageUrl,
  previewItemLabel,
  saving,
  isUploadingCustomImage,
  onOpenImageFilePicker,
  cardImageUploaderRef,
  onCustomImageUploaded,
  onUploadStateChange,
  showIntervals,
  draftStartSec,
  draftEndSec,
  onDraftStartSecChange,
  onDraftEndSecChange,
  resolvedDurationLabel,
  inlineValidationMessage,
  inlineHintMessage,
}: SourceFieldsProps) {
  return (
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
          onChange={(event) => onDraftUrlChange(event.target.value)}
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
                presentation="ambient"
                inset="tight"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-[var(--fg-subtle)]">
                No image
              </div>
            )}
            <button
              type="button"
              onClick={onOpenImageFilePicker}
              disabled={saving || isUploadingCustomImage}
              aria-label="Replace"
              className="absolute inset-x-1 bottom-1 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1 text-[9px] font-medium leading-tight text-[var(--fg-secondary)] opacity-100 transition-all hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--fg-primary)] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 disabled:cursor-default disabled:opacity-60"
            >
              Replace
            </button>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[var(--fg-secondary)]">Item label</span>
              <Input
                type="text"
                placeholder="e.g. The Miracle"
                value={draftLabel}
                onChange={(event) => onDraftLabelChange(event.target.value)}
                maxLength={MAX_ITEM_LABEL_LENGTH}
                disabled={saving}
                className="w-full"
              />
            </label>
          </div>
        </div>
        <ImageUploader
          ref={cardImageUploaderRef}
          onUploaded={onCustomImageUploaded}
          onUploadStateChange={onUploadStateChange}
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
          onChange={(event) => onDraftNoteChange(event.target.value)}
          maxLength={120}
          rows={2}
          disabled={saving}
          placeholder={
            isCreateFromUrlMode
              ? "Short context for rankers (optional)"
              : "Official audio, live version, remix, etc."
          }
          className="w-full"
        />
      </label>

      {showIntervals && (
        <SourceIntervalFields
          draftStartSec={draftStartSec}
          draftEndSec={draftEndSec}
          onStartChange={onDraftStartSecChange}
          onEndChange={onDraftEndSecChange}
          saving={saving}
          resolvedDurationLabel={resolvedDurationLabel}
        />
      )}

      <div className="min-h-[3.75rem]" aria-live="polite">
        {inlineValidationMessage ? (
          <ErrorMessage message={inlineValidationMessage} />
        ) : inlineHintMessage ? (
          <p className="text-xs text-[var(--fg-subtle)]">{inlineHintMessage}</p>
        ) : null}
      </div>
    </>
  );
}
