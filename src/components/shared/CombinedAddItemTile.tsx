"use client";

import { Link as LinkIcon } from "lucide-react";
import { useCallback, useRef } from "react";
import {
  ImageUploader,
  type ImageUploaderHandle,
  type UploadedImage,
} from "@/components/shared/ImageUploader";
import { cn } from "@/lib/utils";

interface CombinedAddItemTileProps {
  onAddByUrlClick: () => void;
  onUploaded: (image: UploadedImage) => void;
  onUploadStateChange?: (uploading: boolean) => void;
  addByUrlDisabled?: boolean;
  uploadDisabled?: boolean;
  uploadIdleLabel?: string;
  addByUrlLabel?: string;
  addByUrlDescription?: string;
  addByUrlAriaLabel?: string;
  multiple?: boolean;
  className?: string;
  matchUploadedItemCardHeight?: boolean;
  labelPlaceholder?: string;
  addByUrlTriggerRef?: React.Ref<HTMLButtonElement>;
  uploadTriggerRef?: React.Ref<HTMLButtonElement>;
}

export function CombinedAddItemTile({
  onAddByUrlClick,
  onUploaded,
  onUploadStateChange,
  addByUrlDisabled = false,
  uploadDisabled = false,
  uploadIdleLabel,
  addByUrlLabel = "Add via URL",
  addByUrlDescription,
  addByUrlAriaLabel = "Add item via URL",
  multiple = false,
  className,
  matchUploadedItemCardHeight = false,
  labelPlaceholder = "Name this pick",
  addByUrlTriggerRef,
  uploadTriggerRef,
}: CombinedAddItemTileProps) {
  const uploaderRef = useRef<ImageUploaderHandle>(null);

  const handleDragOverToUpload = useCallback(
    (e: React.DragEvent) => {
      if (uploadDisabled || e.defaultPrevented) return;
      e.preventDefault();
    },
    [uploadDisabled],
  );

  const handleDropToUpload = useCallback(
    (e: React.DragEvent) => {
      if (uploadDisabled || e.defaultPrevented) return;
      e.preventDefault();
      uploaderRef.current?.uploadFiles(e.dataTransfer.files);
    },
    [uploadDisabled],
  );

  return (
    <div className={cn("flex self-start flex-col", className)}>
      <div
        className={cn(
          "flex flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-1.5",
          matchUploadedItemCardHeight ? "aspect-square w-full" : "",
        )}
      >
        <button
          ref={addByUrlTriggerRef}
          type="button"
          onClick={onAddByUrlClick}
          onDragOver={handleDragOverToUpload}
          onDrop={handleDropToUpload}
          disabled={addByUrlDisabled}
          className={cn(
            "group flex min-h-[64px] flex-[5] flex-col items-center justify-center rounded border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-2 text-center text-[var(--fg-secondary)] transition-colors",
            addByUrlDisabled
              ? "cursor-not-allowed opacity-60"
              : "hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--accent-primary-hover)]",
          )}
          aria-label={addByUrlAriaLabel}
        >
          <LinkIcon className="h-5 w-5" />
          <span className="mt-1 text-xs font-medium">{addByUrlLabel}</span>
          {addByUrlDescription ? (
            <span className="mt-1 text-[11px] text-[var(--fg-subtle)]">{addByUrlDescription}</span>
          ) : null}
        </button>

        <ImageUploader
          ref={uploaderRef}
          onUploaded={onUploaded}
          onUploadStateChange={onUploadStateChange}
          multiple={multiple}
          idleLabel={uploadIdleLabel}
          disabled={uploadDisabled}
          triggerRef={uploadTriggerRef}
          className="mt-1 min-h-[72px] flex-[7] w-full"
        />
      </div>

      {matchUploadedItemCardHeight && (
        <div
          aria-hidden="true"
          className="pointer-events-none mt-2 w-full rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm text-[var(--fg-subtle)]"
        >
          {labelPlaceholder}
        </div>
      )}
    </div>
  );
}
