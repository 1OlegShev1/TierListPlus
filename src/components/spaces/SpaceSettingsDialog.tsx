"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

interface SpaceSettingsDialogProps {
  closeHref: string;
  children: ReactNode;
}

export function SpaceSettingsDialog({ closeHref, children }: SpaceSettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  const close = () => {
    router.replace(closeHref);
    router.refresh();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) {
      dialog.showModal();
    }

    const frame = window.requestAnimationFrame(() => {
      const firstFocusable = dialog.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (firstFocusable ?? dialog).focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      aria-labelledby="space-settings-title"
      className="fixed inset-0 z-50 m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),48rem)] overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-left text-[var(--fg-primary)] shadow-2xl shadow-black/60 backdrop:bg-[var(--bg-overlay)] focus:outline-none sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="space-settings-title" className="text-lg font-semibold text-[var(--fg-primary)]">
          Space settings
        </h2>
      </div>
      {children}
    </dialog>
  );
}
