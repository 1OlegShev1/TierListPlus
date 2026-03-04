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

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="fixed inset-0 m-auto w-[min(calc(100vw-2rem),32rem)] rounded-xl border border-neutral-700 bg-neutral-900 p-6 text-left text-white shadow-2xl shadow-black/60 backdrop:bg-black/70 focus:outline-none"
    >
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      <p className="mb-6 text-sm text-neutral-400">{description}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            confirmVariant === "danger" && "bg-red-600 hover:bg-red-500",
            confirmVariant === "primary" && "bg-amber-500 text-black hover:bg-amber-400",
          )}
        >
          {loading
            ? (loadingLabel ?? (confirmVariant === "danger" ? "Deleting..." : "Working..."))
            : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
