"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { useDelayedBusy } from "@/hooks/useDelayedBusy";
import {
  CLIENT_UPLOAD_IMAGE_QUALITY,
  CLIENT_UPLOAD_IMAGE_SIZE,
  UPLOAD_MAX_BYTES,
} from "@/lib/upload-config";

export interface UploadedImage {
  url: string;
  suggestedLabel: string;
  originalName: string;
}

interface ImageUploaderProps {
  onUploaded: (image: UploadedImage) => void;
  onUploadStateChange?: (uploading: boolean) => void;
  multiple?: boolean;
  className?: string;
  compact?: boolean;
  idleLabel?: string;
  disabled?: boolean;
  triggerRef?: React.Ref<HTMLButtonElement>;
  uploadVariant?: "item" | "space_logo";
}

export interface ImageUploaderHandle {
  openFilePicker: () => void;
  uploadFiles: (files: FileList | File[]) => void;
}

interface UploadProgress {
  total: number;
  completed: number;
}

interface BatchUploadOutcome {
  message?: string;
  uploadedImage?: UploadedImage;
}

const UPLOAD_MAX_MB = Math.round(UPLOAD_MAX_BYTES / (1024 * 1024));

function toUploadFilename(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  const basename = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  return `${basename || "upload"}.webp`;
}

function getSuggestedLabel(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  const basename = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const normalized = basename.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  if (!normalized) return "";
  if (/^(img|dsc|pxl|image|photo)[-_ ]?\d+$/i.test(normalized)) return "";
  if (/^[a-f0-9]{8,}$/i.test(normalized)) return "";

  return normalized.slice(0, 100).trim();
}

function canvasToWebpBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/webp", CLIENT_UPLOAD_IMAGE_QUALITY);
  });
}

function hasExplicitNonImageType(file: File): boolean {
  return file.type.length > 0 && !file.type.startsWith("image/");
}

function isGifFile(file: File): boolean {
  if (file.type.toLowerCase() === "image/gif") return true;
  return file.name.toLowerCase().endsWith(".gif");
}

async function prepareFileForUpload(file: File, variant: "item" | "space_logo"): Promise<File> {
  if (variant === "item" && isGifFile(file)) {
    return file;
  }

  if (typeof window === "undefined" || typeof createImageBitmap !== "function") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    if (bitmap.width <= 0 || bitmap.height <= 0) return file;

    const targetSize = CLIENT_UPLOAD_IMAGE_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;

    const context = canvas.getContext("2d");
    if (!context) return file;

    const scale =
      variant === "space_logo"
        ? Math.max(targetSize / bitmap.width, targetSize / bitmap.height)
        : Math.min(1, targetSize / bitmap.width, targetSize / bitmap.height);
    const drawWidth = Math.round(bitmap.width * scale);
    const drawHeight = Math.round(bitmap.height * scale);
    const offsetX = Math.floor((targetSize - drawWidth) / 2);
    const offsetY = Math.floor((targetSize - drawHeight) / 2);

    context.clearRect(0, 0, targetSize, targetSize);
    context.drawImage(bitmap, offsetX, offsetY, drawWidth, drawHeight);

    const blob = await canvasToWebpBlob(canvas);
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], toUploadFilename(file.name), {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}

async function uploadFile(file: File, variant: "item" | "space_logo"): Promise<UploadedImage> {
  const preparedFile = await prepareFileForUpload(file, variant);
  if (preparedFile.size > UPLOAD_MAX_BYTES) {
    throw new Error(`File too large (max ${UPLOAD_MAX_MB}MB)`);
  }

  const formData = new FormData();
  formData.append("file", preparedFile);
  formData.append("variant", variant);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Upload failed");
  }
  const { url } = await res.json();
  return {
    url,
    suggestedLabel: getSuggestedLabel(file.name),
    originalName: file.name,
  };
}

export const ImageUploader = forwardRef<ImageUploaderHandle, ImageUploaderProps>(
  function ImageUploader(
    {
      onUploaded,
      onUploadStateChange,
      multiple = false,
      className,
      compact = false,
      idleLabel,
      disabled = false,
      triggerRef,
      uploadVariant = "item",
    }: ImageUploaderProps,
    ref,
  ) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<UploadProgress | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [failures, setFailures] = useState<string[]>([]);
    const showUploadingState = useDelayedBusy(uploading, {
      showDelayMs: 180,
      minVisibleMs: 320,
    });
    const uploadInteractionLocked = uploading || showUploadingState;

    const setUploadingState = useCallback(
      (next: boolean) => {
        setUploading(next);
        onUploadStateChange?.(next);
      },
      [onUploadStateChange],
    );

    const showSelectionError = useCallback((message: string, fileName?: string) => {
      setError(message);
      setFailures(fileName ? [`${fileName} - ${message}`] : []);
    }, []);

    const upload = useCallback(
      async (file: File) => {
        setUploadingState(true);
        setError(null);
        setFailures([]);
        try {
          const uploadedImage = await uploadFile(file, uploadVariant);
          onUploaded(uploadedImage);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          setError(msg);
          setFailures([`${file.name} - ${msg}`]);
        } finally {
          setUploadingState(false);
        }
      },
      [onUploaded, setUploadingState, uploadVariant],
    );

    const uploadBatch = useCallback(
      async (files: File[]) => {
        setUploadingState(true);
        setError(null);
        setFailures([]);

        const failed: string[] = [];
        const imageFiles: File[] = [];

        // Pre-filter non-image files
        for (const file of files) {
          if (hasExplicitNonImageType(file)) {
            failed.push(`${file.name} - Not a supported image file`);
          } else {
            imageFiles.push(file);
          }
        }

        if (imageFiles.length === 0) {
          setFailures(failed);
          setUploadingState(false);
          if (failed.length > 0) {
            setError(`No valid images selected`);
          }
          return;
        }

        setProgress({ total: imageFiles.length, completed: 0 });

        const settledUploads: Array<BatchUploadOutcome | undefined> = new Array(imageFiles.length);
        let nextUploadIndex = 0;

        // Upload all image files in parallel
        await Promise.all(
          imageFiles.map(async (file, index) => {
            try {
              settledUploads[index] = {
                uploadedImage: await uploadFile(file, uploadVariant),
              };
            } catch (err) {
              settledUploads[index] = {
                message: err instanceof Error ? err.message : "upload failed",
              };
            } finally {
              while (nextUploadIndex < settledUploads.length && settledUploads[nextUploadIndex]) {
                const outcome = settledUploads[nextUploadIndex];
                const currentFile = imageFiles[nextUploadIndex];

                if (outcome?.uploadedImage) {
                  onUploaded(outcome.uploadedImage);
                } else if (outcome?.message) {
                  failed.push(`${currentFile.name} - ${outcome.message}`);
                }

                nextUploadIndex += 1;
              }

              setProgress((prev) => (prev ? { ...prev, completed: prev.completed + 1 } : null));
            }
          }),
        );

        if (failed.length > 0) {
          setFailures(failed);
          setError(
            `Failed to upload ${failed.length} of ${files.length} file${files.length === 1 ? "" : "s"}`,
          );
        }

        setUploadingState(false);
        setProgress(null);
      },
      [onUploaded, setUploadingState, uploadVariant],
    );

    const handleFiles = useCallback(
      (incomingFiles: FileList | File[]) => {
        if (disabled || uploading) return;
        const files = Array.isArray(incomingFiles) ? incomingFiles : Array.from(incomingFiles);
        if (files.length === 0) return;

        if (multiple && files.length > 1) {
          uploadBatch(files);
        } else {
          const file = files[0];
          if (!file) return;
          if (hasExplicitNonImageType(file)) {
            showSelectionError("Not a supported image file", file.name);
          } else {
            upload(file);
          }
        }
      },
      [disabled, multiple, showSelectionError, upload, uploadBatch, uploading],
    );

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        if (disabled || uploading) return;
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      },
      [disabled, handleFiles, uploading],
    );

    const handleFileInput = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = e.target.files;
        if (disabled) {
          e.target.value = "";
          return;
        }
        if (!fileList?.length) return;

        handleFiles(fileList);
        e.target.value = "";
      },
      [disabled, handleFiles],
    );

    const dismissErrors = () => {
      setError(null);
      setFailures([]);
    };

    const openFilePicker = useCallback(() => {
      if (disabled || uploading) return;
      fileInputRef.current?.click();
    }, [disabled, uploading]);

    useImperativeHandle(
      ref,
      () => ({
        openFilePicker,
        uploadFiles: (incomingFiles) => {
          handleFiles(incomingFiles);
        },
      }),
      [handleFiles, openFilePicker],
    );

    const pickerDisabled = disabled || uploadInteractionLocked;

    return (
      <div className={`relative flex flex-col ${className ?? ""}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={handleFileInput}
          disabled={pickerDisabled}
          aria-label={multiple ? "Upload images" : "Upload image"}
        />
        <button
          ref={triggerRef}
          type="button"
          className={`flex min-h-0 w-full flex-1 items-center justify-center rounded-lg transition-colors ${
            disabled
              ? "cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-surface)] opacity-70"
              : uploadInteractionLocked
                ? "cursor-progress border-[var(--border-default)] bg-[var(--bg-surface)]"
                : "cursor-pointer"
          } ${
            dragOver && !pickerDisabled
              ? "border-[var(--accent-primary)] bg-[var(--bg-soft-contrast)]"
              : compact
                ? "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]"
                : "border-[var(--border-default)] hover:border-[var(--border-strong)]"
          } ${compact ? "min-h-10 gap-2 border px-3 py-2" : "flex-col border-2 border-dashed"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-canvas)]`}
          onClick={openFilePicker}
          onDragOver={(e) => {
            e.preventDefault();
            if (pickerDisabled) return;
            setDragOver(true);
          }}
          onDragLeave={() => {
            if (pickerDisabled) return;
            setDragOver(false);
          }}
          onDrop={handleDrop}
          disabled={pickerDisabled}
          aria-busy={uploadInteractionLocked || undefined}
        >
          {disabled ? (
            <span className="text-sm text-[var(--fg-subtle)]">
              {idleLabel ?? "Upload unavailable"}
            </span>
          ) : showUploadingState && progress ? (
            <span className="text-sm text-[var(--fg-muted)]">
              Uploading {progress.completed}/{progress.total}...
            </span>
          ) : showUploadingState ? (
            <span className="text-sm text-[var(--fg-muted)]">Uploading...</span>
          ) : (
            <>
              <span
                className={
                  compact
                    ? "text-sm font-semibold text-[var(--fg-muted)]"
                    : "text-2xl text-[var(--fg-subtle)]"
                }
              >
                +
              </span>
              <span
                className={`${compact ? "text-sm font-medium text-[var(--fg-secondary)]" : "text-xs text-[var(--fg-subtle)]"}`}
              >
                {idleLabel ?? (multiple ? "Drop images or click" : "Drop image or click")}
              </span>
            </>
          )}
        </button>

        {failures.length > 0 && (
          <div className="absolute left-0 top-full z-20 mt-3 w-[min(32rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--state-danger-fg)] bg-[var(--bg-elevated)] p-4 shadow-2xl backdrop-blur-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-5 text-[var(--state-danger-fg)]">
                  {error}
                </p>
                <p className="mt-1 text-xs text-[var(--fg-subtle)]">
                  Review the files below and try again.
                </p>
                <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-[var(--state-danger-fg)]/60 bg-[var(--bg-soft-contrast)] p-3 pr-2">
                  {failures.map((msg) => (
                    <li
                      key={msg}
                      className="break-words text-xs leading-5 text-[var(--state-danger-fg)]"
                    >
                      {msg}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={dismissErrors}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
                aria-label="Dismiss errors"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {error && failures.length === 0 && (
          <div className="mt-2 text-center">
            <span className="text-xs text-[var(--state-danger-fg)]">{error}</span>
          </div>
        )}
      </div>
    );
  },
);

ImageUploader.displayName = "ImageUploader";
