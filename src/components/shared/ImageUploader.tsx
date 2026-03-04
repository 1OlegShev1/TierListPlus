"use client";

import { useCallback, useRef, useState } from "react";
import { CloseIcon } from "@/components/ui/icons";
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

async function prepareFileForUpload(file: File): Promise<File> {
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

    const scale = Math.min(1, targetSize / bitmap.width, targetSize / bitmap.height);
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

async function uploadFile(file: File): Promise<UploadedImage> {
  const preparedFile = await prepareFileForUpload(file);
  if (preparedFile.size > UPLOAD_MAX_BYTES) {
    throw new Error(`File too large (max ${UPLOAD_MAX_MB}MB)`);
  }

  const formData = new FormData();
  formData.append("file", preparedFile);
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

export function ImageUploader({
  onUploaded,
  onUploadStateChange,
  multiple = false,
  className,
  compact = false,
  idleLabel,
  disabled = false,
  triggerRef,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);

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
        const uploadedImage = await uploadFile(file);
        onUploaded(uploadedImage);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setError(msg);
        setFailures([`${file.name} - ${msg}`]);
      } finally {
        setUploadingState(false);
      }
    },
    [onUploaded, setUploadingState],
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
              uploadedImage: await uploadFile(file),
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
    [onUploaded, setUploadingState],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled || uploading) return;
      setDragOver(false);
      const fileList = e.dataTransfer.files;
      if (!fileList.length) return;

      if (multiple && fileList.length > 1) {
        uploadBatch(Array.from(fileList));
      } else {
        const file = fileList[0];
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

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (disabled) {
        e.target.value = "";
        return;
      }
      if (!fileList?.length) return;

      if (multiple && fileList.length > 1) {
        uploadBatch(Array.from(fileList));
      } else {
        const file = fileList[0];
        if (!file) return;
        if (hasExplicitNonImageType(file)) {
          showSelectionError("Not a supported image file", file.name);
        } else {
          upload(file);
        }
      }
      e.target.value = "";
    },
    [disabled, multiple, showSelectionError, upload, uploadBatch],
  );

  const dismissErrors = () => {
    setError(null);
    setFailures([]);
  };

  const openFilePicker = () => {
    if (disabled || uploading) return;
    fileInputRef.current?.click();
  };

  const pickerDisabled = disabled || uploading;

  return (
    <div className={`relative ${className ?? ""}`}>
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
        className={`flex h-full w-full items-center justify-center rounded-lg transition-colors ${
          disabled
            ? "cursor-not-allowed border-neutral-800 bg-neutral-900/60 opacity-70"
            : uploading
              ? "cursor-progress border-neutral-700 bg-neutral-900/60"
              : "cursor-pointer"
        } ${
          dragOver && !pickerDisabled
            ? "border-amber-400 bg-amber-400/10"
            : compact
              ? "border-neutral-700 bg-neutral-950/80 hover:border-neutral-500"
              : "border-neutral-700 hover:border-neutral-500"
        } ${compact ? "min-h-10 gap-2 border px-3 py-2" : "flex-col border-2 border-dashed"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black`}
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
        aria-busy={uploading || undefined}
      >
        {disabled ? (
          <span className="text-sm text-neutral-500">{idleLabel ?? "Upload unavailable"}</span>
        ) : uploading && progress ? (
          <span className="text-sm text-neutral-400">
            Uploading {progress.completed}/{progress.total}...
          </span>
        ) : uploading ? (
          <span className="text-sm text-neutral-400">Uploading...</span>
        ) : (
          <>
            <span
              className={
                compact ? "text-sm font-semibold text-neutral-400" : "text-2xl text-neutral-500"
              }
            >
              +
            </span>
            <span
              className={`${compact ? "text-sm font-medium text-neutral-300" : "text-xs text-neutral-500"}`}
            >
              {idleLabel ?? (multiple ? "Drop images or click" : "Drop image or click")}
            </span>
          </>
        )}
      </button>

      {failures.length > 0 && (
        <div className="absolute left-0 top-full z-20 mt-3 w-[min(32rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-xl border border-red-900/80 bg-neutral-950/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5 text-red-200">{error}</p>
              <p className="mt-1 text-xs text-neutral-500">Review the files below and try again.</p>
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-red-950/60 bg-black/20 p-3 pr-2">
                {failures.map((msg) => (
                  <li key={msg} className="break-words text-xs leading-5 text-red-100/85">
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={dismissErrors}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-100"
              aria-label="Dismiss errors"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {error && failures.length === 0 && (
        <div className="mt-2 text-center">
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}
    </div>
  );
}
