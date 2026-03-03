"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { TIER_COLORS } from "@/lib/constants";

interface TierColorPickerProps {
  color: string;
  label: string;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  onColorChange: (color: string) => void;
}

export function TierColorPicker({
  color,
  label,
  canEdit,
  isFirst,
  isLast,
  onColorChange,
}: TierColorPickerProps) {
  const [open, setOpen] = useState(false);
  const pickerId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstColorRef = useRef<HTMLButtonElement>(null);
  const selectedColorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const nextFocusTarget = selectedColorRef.current ?? firstColorRef.current;
      nextFocusTarget?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  const closePicker = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (!restoreFocus) return;
    window.requestAnimationFrame(() => {
      buttonRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closePicker();
    };
    const handleFocus = (e: FocusEvent) => {
      const nextTarget = e.target as Node | null;
      if (nextTarget && ref.current && !ref.current.contains(nextTarget)) {
        closePicker();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      closePicker(true);
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
  }, [open, closePicker]);

  return (
    <div ref={ref} className="relative flex self-stretch">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!canEdit) return;
          if (open) {
            closePicker(true);
            return;
          }
          setOpen(true);
        }}
        className={`flex w-5 items-center justify-center transition-opacity ${canEdit ? "cursor-pointer hover:opacity-70" : "cursor-default"} ${isFirst ? "rounded-tl-lg" : ""} ${isLast ? "rounded-bl-lg" : ""}`}
        style={{ backgroundColor: color }}
        title={canEdit ? "Change color" : undefined}
        aria-label={canEdit ? `Change color for ${label} tier` : `${label} tier color`}
        aria-expanded={canEdit ? open : undefined}
        aria-controls={canEdit && open ? pickerId : undefined}
      />
      <div className="w-px self-stretch bg-neutral-800" />

      {canEdit && open && (
        <div
          id={pickerId}
          className="absolute top-full left-0 z-20 mt-1 w-44 rounded-lg border border-neutral-700 bg-neutral-800 p-2.5 shadow-lg"
        >
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(4, 32px)" }}>
            {TIER_COLORS.map((c, index) => (
              <button
                key={c}
                ref={c === color ? selectedColorRef : index === 0 ? firstColorRef : undefined}
                type="button"
                onClick={() => {
                  onColorChange(c);
                  closePicker(true);
                }}
                className={`h-8 w-8 cursor-pointer rounded transition-transform hover:scale-110 ${c === color ? "ring-2 ring-white ring-offset-2 ring-offset-neutral-800" : ""}`}
                style={{ backgroundColor: c }}
                aria-label={c === color ? `Current color ${c}` : `Set color to ${c}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
