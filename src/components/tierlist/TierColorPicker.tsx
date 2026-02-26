"use client";

import { useEffect, useRef, useState } from "react";
import { TIER_COLORS } from "@/lib/constants";

interface TierColorPickerProps {
  color: string;
  label: string;
  isFirst: boolean;
  isLast: boolean;
  onColorChange: (color: string) => void;
}

export function TierColorPicker({
  color,
  label,
  isFirst,
  isLast,
  onColorChange,
}: TierColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={ref} className="relative flex self-stretch">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex w-4 cursor-pointer items-center justify-center transition-opacity hover:opacity-70 ${isFirst ? "rounded-tl-lg" : ""} ${isLast ? "rounded-bl-lg" : ""}`}
        style={{ backgroundColor: color }}
        title="Change color"
        aria-label={`Change color for ${label} tier`}
        aria-expanded={open}
      >
        <span className="text-[8px] text-black/40">&#x25cf;</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-44 rounded-lg border border-neutral-700 bg-neutral-800 p-2.5 shadow-lg">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(4, 32px)" }}>
            {TIER_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  onColorChange(c);
                  setOpen(false);
                }}
                className={`h-8 w-8 cursor-pointer rounded transition-transform hover:scale-110 ${c === color ? "ring-2 ring-white ring-offset-2 ring-offset-neutral-800" : ""}`}
                style={{ backgroundColor: c }}
                aria-label={`Set color to ${c}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
