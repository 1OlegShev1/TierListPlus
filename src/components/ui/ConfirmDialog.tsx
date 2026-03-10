"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loadingLabel?: string;
  preserveLabelWhileLoading?: boolean;
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  loadingLabel,
  preserveLabelWhileLoading = false,
  confirmVariant = "danger",
  onConfirm,
  onCancel,
  loading,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const confirmButtonLabel = loading
    ? preserveLabelWhileLoading
      ? confirmLabel
      : (loadingLabel ?? (confirmVariant === "danger" ? "Deleting..." : "Working..."))
    : confirmLabel;

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="fixed inset-0 m-auto w-[min(calc(100vw-2rem),32rem)] rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-left text-[var(--fg-primary)] shadow-2xl shadow-black/60 backdrop:bg-[var(--bg-overlay)] focus:outline-none"
    >
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      <p className="mb-6 text-sm text-[var(--fg-muted)]">{description}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            confirmVariant === "danger" &&
              "bg-[var(--action-danger-bg)] text-[var(--action-danger-fg)] hover:bg-[var(--action-danger-bg-hover)]",
            confirmVariant === "primary" &&
              "bg-[var(--action-primary-bg)] text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-bg-hover)]",
          )}
        >
          {confirmButtonLabel}
        </Button>
      </div>
    </dialog>
  );
}
