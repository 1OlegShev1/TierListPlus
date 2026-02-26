"use client";

import { useCallback, useState } from "react";

interface ImageUploaderProps {
  onUploaded: (url: string) => void;
  className?: string;
}

export function ImageUploader({ onUploaded, className }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const { url } = await res.json();
        onUploaded(url);
      } finally {
        setUploading(false);
      }
    },
    [onUploaded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) upload(file);
    },
    [upload],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) upload(file);
      e.target.value = "";
    },
    [upload],
  );

  return (
    <label
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
        dragOver
          ? "border-amber-400 bg-amber-400/10"
          : "border-neutral-700 hover:border-neutral-500"
      } ${className ?? ""}`}
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
        className="hidden"
        onChange={handleFileInput}
        disabled={uploading}
      />
      {uploading ? (
        <span className="text-sm text-neutral-400">Uploading...</span>
      ) : (
        <>
          <span className="text-2xl text-neutral-500">+</span>
          <span className="text-xs text-neutral-500">Drop image or click</span>
        </>
      )}
    </label>
  );
}
