"use client";

import { useCallback, useState } from "react";

interface ImageUploaderProps {
  onUploaded: (url: string) => void;
  multiple?: boolean;
  className?: string;
}

interface UploadProgress {
  total: number;
  completed: number;
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Upload failed");
  }
  const { url } = await res.json();
  return url;
}

export function ImageUploader({ onUploaded, multiple = false, className }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<string[]>([]);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      setFailures([]);
      try {
        const url = await uploadFile(file);
        onUploaded(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onUploaded],
  );

  const uploadBatch = useCallback(
    async (files: File[]) => {
      setUploading(true);
      setError(null);
      setFailures([]);

      const failed: string[] = [];
      const imageFiles: File[] = [];

      // Pre-filter non-image files
      for (const file of files) {
        if (file.type.startsWith("image/")) {
          imageFiles.push(file);
        } else {
          failed.push(`${file.name} — not an image`);
        }
      }

      if (imageFiles.length === 0) {
        setFailures(failed);
        setUploading(false);
        if (failed.length > 0) {
          setError(`No valid images selected`);
        }
        return;
      }

      setProgress({ total: imageFiles.length, completed: 0 });

      // Upload all image files in parallel
      await Promise.allSettled(
        imageFiles.map(async (file) => {
          try {
            const url = await uploadFile(file);
            onUploaded(url);
            setProgress((prev) => (prev ? { ...prev, completed: prev.completed + 1 } : null));
            return url;
          } catch (err) {
            const msg = err instanceof Error ? err.message : "upload failed";
            failed.push(`${file.name} — ${msg}`);
            setProgress((prev) => (prev ? { ...prev, completed: prev.completed + 1 } : null));
            throw err;
          }
        }),
      );

      if (failed.length > 0) {
        setFailures(failed);
        setError(`${failed.length} of ${files.length} file${files.length > 1 ? "s" : ""} failed`);
      }

      setUploading(false);
      setProgress(null);
    },
    [onUploaded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const fileList = e.dataTransfer.files;
      if (!fileList.length) return;

      if (multiple && fileList.length > 1) {
        uploadBatch(Array.from(fileList));
      } else {
        const file = fileList[0];
        if (file?.type.startsWith("image/")) upload(file);
      }
    },
    [upload, uploadBatch, multiple],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList?.length) return;

      if (multiple && fileList.length > 1) {
        uploadBatch(Array.from(fileList));
      } else {
        const file = fileList[0];
        if (file) upload(file);
      }
      e.target.value = "";
    },
    [upload, uploadBatch, multiple],
  );

  const dismissErrors = () => {
    setError(null);
    setFailures([]);
  };

  return (
    <div className={className}>
      <label
        className={`flex h-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
          dragOver
            ? "border-amber-400 bg-amber-400/10"
            : "border-neutral-700 hover:border-neutral-500"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={handleFileInput}
          disabled={uploading}
          aria-label={multiple ? "Upload images" : "Upload image"}
        />
        {uploading && progress ? (
          <span className="text-sm text-neutral-400">
            Uploading {progress.completed}/{progress.total}...
          </span>
        ) : uploading ? (
          <span className="text-sm text-neutral-400">Uploading...</span>
        ) : (
          <>
            <span className="text-2xl text-neutral-500">+</span>
            <span className="text-xs text-neutral-500">
              {multiple ? "Drop images or click" : "Drop image or click"}
            </span>
          </>
        )}
      </label>

      {failures.length > 0 && (
        <div className="mt-2 rounded border border-red-800 bg-red-950/50 p-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-red-400">{error}</p>
              <ul className="mt-1 space-y-0.5">
                {failures.map((msg) => (
                  <li key={msg} className="truncate text-xs text-red-300/70">
                    {msg}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={dismissErrors}
              className="shrink-0 text-xs text-neutral-500 hover:text-neutral-300"
              aria-label="Dismiss errors"
            >
              ✕
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
