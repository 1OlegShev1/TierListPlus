"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CloseIcon, EllipsisVerticalIcon, PlusIcon } from "@/components/ui/icons";

interface TierRowActionsProps {
  label: string;
  canDelete: boolean;
  isLast: boolean;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDelete: () => void;
}

export function TierRowActions({
  label,
  canDelete,
  isLast,
  onInsertAbove,
  onInsertBelow,
  onDelete,
}: TierRowActionsProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      firstActionRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (!restoreFocus) return;
    window.requestAnimationFrame(() => {
      buttonRef.current?.focus();
    });
  }, []);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    const handlePointer = (e: MouseEvent | TouchEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };

    const handleFocus = (e: FocusEvent) => {
      const nextTarget = e.target as Node | null;
      if (
        nextTarget &&
        menuRef.current &&
        !menuRef.current.contains(nextTarget) &&
        buttonRef.current &&
        !buttonRef.current.contains(nextTarget)
      ) {
        closeMenu();
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      closeMenu(true);
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("focusin", handleFocus);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, closeMenu]);

  const toggle = () => {
    if (!open) {
      if (isLast) {
        setOpenUpward(true);
      } else {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (rect) {
          setOpenUpward(window.innerHeight - rect.bottom < 180);
        }
      }
    }
    setOpen((v) => !v);
  };

  const act = (fn: () => void) => {
    fn();
    closeMenu(true);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        className="cursor-pointer rounded border border-neutral-700 bg-neutral-900/80 p-1 text-neutral-300 hover:border-neutral-500 hover:text-neutral-100"
        title="Tier actions"
        aria-label={`Actions for ${label} tier`}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <EllipsisVerticalIcon className="h-4 w-4" />
      </button>

      {open && (
        <div
          id={menuId}
          ref={menuRef}
          className={`absolute right-0 z-20 min-w-[168px] rounded-lg border border-neutral-700 bg-neutral-800 py-1.5 shadow-lg ${
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <button
            ref={firstActionRef}
            type="button"
            onClick={() => act(onInsertAbove)}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-700"
          >
            <PlusIcon className="h-4 w-4" /> Insert above
          </button>
          <button
            type="button"
            onClick={() => act(onInsertBelow)}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-700"
          >
            <PlusIcon className="h-4 w-4" /> Insert below
          </button>
          <hr className="my-1 border-neutral-700" />
          <button
            type="button"
            onClick={() => act(onDelete)}
            disabled={!canDelete}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-red-400 hover:bg-neutral-700 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <CloseIcon className="h-4 w-4" /> Delete row
          </button>
        </div>
      )}
    </div>
  );
}
