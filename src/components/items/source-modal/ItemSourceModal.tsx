"use client";

import { useEffect, useRef, useState } from "react";
import { SourceFields } from "@/components/items/source-modal/SourceFields";
import { SourcePreviewPanel } from "@/components/items/source-modal/SourcePreviewPanel";
import type { ItemSourceModalProps } from "@/components/items/source-modal/types";
import { useImageReplacementLifecycle } from "@/components/items/source-modal/useImageReplacementLifecycle";
import { useSourceDraft } from "@/components/items/source-modal/useSourceDraft";
import { formatIntervalInputValue } from "@/components/items/source-modal/utils";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

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

  const [draftUrl, setDraftUrl] = useState(sourceUrl ?? "");
  const [draftLabel, setDraftLabel] = useState(itemLabel);
  const [draftLabelTouched, setDraftLabelTouched] = useState(false);
  const [draftNote, setDraftNote] = useState(sourceNote ?? "");
  const [draftStartSec, setDraftStartSec] = useState(formatIntervalInputValue(sourceStartSec));
  const [draftEndSec, setDraftEndSec] = useState(formatIntervalInputValue(sourceEndSec));
  const [draftReplacementImageUrl, setDraftReplacementImageUrl] = useState<string | null>(null);
  const [embedParentHostname, setEmbedParentHostname] = useState("");

  const {
    cardImageUploaderRef,
    isUploadingCustomImage,
    setIsUploadingCustomImage,
    handleCustomImageUploaded,
    openImageFilePicker,
    isWithinImagePickerCancelGuard,
    cleanupPendingUploadedImages,
    markSavedImageAsAttached,
    resetImagePickerGuard,
  } = useImageReplacementLifecycle({
    draftReplacementImageUrl,
    setDraftReplacementImageUrl,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEmbedParentHostname(window.location.hostname);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("overlay:modal-open"));
    }
    setDraftUrl(sourceUrl ?? "");
    setDraftLabel(itemLabel);
    setDraftLabelTouched(false);
    setDraftNote(sourceNote ?? "");
    setDraftStartSec(formatIntervalInputValue(sourceStartSec));
    setDraftEndSec(formatIntervalInputValue(sourceEndSec));
    setDraftReplacementImageUrl(null);
    setIsUploadingCustomImage(false);
    resetImagePickerGuard();
  }, [
    itemLabel,
    open,
    resetImagePickerGuard,
    setIsUploadingCustomImage,
    sourceEndSec,
    sourceNote,
    sourceStartSec,
    sourceUrl,
  ]);

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

  const {
    isCreateFromUrlMode,
    trimmedDraftUrl,
    trimmedDraftNote,
    activeParsedSource,
    shouldValidateIntervals,
    parsedDraftStartSec,
    parsedDraftEndSec,
    resolvedDurationLabel,
    resolvedPreviewTitle,
    fallbackCreateLabel,
    resolvedDraftLabel,
    previewItemLabel,
    previewImageUrl,
    selectedImageUrl,
    previewPanelModel,
    inlineValidationMessage,
    inlineHintMessage,
    hasLabelChange,
    hasImageChange,
    canSave,
    isResolvingSourcePreview,
  } = useSourceDraft({
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
    hasSaveHandler: !!onSave,
  });

  useEffect(() => {
    if (!isCreateFromUrlMode || draftLabelTouched) return;
    setDraftLabel(fallbackCreateLabel);
  }, [draftLabelTouched, fallbackCreateLabel, isCreateFromUrlMode]);

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

    const nextResolvedImageUrl = (selectedImageUrl ?? "").trim() || null;
    if (isCreateFromUrlMode) {
      payload.itemLabel = resolvedDraftLabel || fallbackCreateLabel;
      payload.resolvedImageUrl = nextResolvedImageUrl;
      payload.resolvedTitle = resolvedPreviewTitle || null;
    } else {
      if (hasLabelChange) payload.itemLabel = resolvedDraftLabel;
      if (hasImageChange && nextResolvedImageUrl) payload.resolvedImageUrl = nextResolvedImageUrl;
    }

    const succeeded = await onSave(payload);
    if (succeeded) {
      markSavedImageAsAttached(payload.resolvedImageUrl);
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
          if (dialogRef.current && !dialogRef.current.open && open) dialogRef.current.showModal();
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
          if (dialogRef.current && !dialogRef.current.open && open) dialogRef.current.showModal();
          return;
        }
        if (open && !saving && !isUploadingCustomImage) close();
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
        {editable && (
          <SourceFields
            isCreateFromUrlMode={isCreateFromUrlMode}
            sourceInputRef={sourceInputRef}
            draftUrl={draftUrl}
            onDraftUrlChange={setDraftUrl}
            draftLabel={draftLabel}
            onDraftLabelChange={(value) => {
              setDraftLabel(value);
              setDraftLabelTouched(true);
            }}
            draftNote={draftNote}
            onDraftNoteChange={setDraftNote}
            previewImageUrl={previewImageUrl}
            previewItemLabel={previewItemLabel}
            saving={saving}
            isUploadingCustomImage={isUploadingCustomImage}
            onOpenImageFilePicker={() => openImageFilePicker(saving)}
            cardImageUploaderRef={cardImageUploaderRef}
            onCustomImageUploaded={handleCustomImageUploaded}
            onUploadStateChange={setIsUploadingCustomImage}
            showIntervals={activeParsedSource?.provider === "YOUTUBE"}
            draftStartSec={draftStartSec}
            draftEndSec={draftEndSec}
            onDraftStartSecChange={setDraftStartSec}
            onDraftEndSecChange={setDraftEndSec}
            resolvedDurationLabel={resolvedDurationLabel}
            inlineValidationMessage={inlineValidationMessage}
            inlineHintMessage={inlineHintMessage ?? null}
          />
        )}

        <SourcePreviewPanel model={previewPanelModel} />

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
    </dialog>
  );
}
