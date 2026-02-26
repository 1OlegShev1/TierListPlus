"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, EllipsisVerticalIcon, PlusIcon } from "@/components/ui/icons";

interface TierRowActionsProps {
  label: string;
  canDelete: boolean;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDelete: () => void;
}

export function TierRowActions({
  label,
  canDelete,
  onInsertAbove,
  onInsertBelow,
  onDelete,
}: TierRowActionsProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        setOpenUpward(window.innerHeight - rect.bottom < 180);
      }
    }
    setOpen((v) => !v);
  };

  const act = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggle}
        className="cursor-pointer p-1 text-neutral-500 hover:text-neutral-200"
        title="Tier actions"
        aria-label={`Actions for ${label} tier`}
        aria-expanded={open}
      >
        <EllipsisVerticalIcon className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          ref={menuRef}
          className={`absolute right-0 z-20 min-w-[152px] rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-lg ${
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <button
            onClick={() => act(onInsertAbove)}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-700"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Insert above
          </button>
          <button
            onClick={() => act(onInsertBelow)}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-neutral-300 hover:bg-neutral-700"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Insert below
          </button>
          <hr className="my-1 border-neutral-700" />
          <button
            onClick={() => act(onDelete)}
            disabled={!canDelete}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-red-400 hover:bg-neutral-700 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <CloseIcon className="h-3.5 w-3.5" /> Delete row
          </button>
        </div>
      )}
    </div>
  );
}
