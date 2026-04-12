"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Portal } from "@/components/ui/Portal";
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
  const menuRef = useRef<HTMLDivElement>(null);
  const firstColorRef = useRef<HTMLButtonElement>(null);
  const selectedColorRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

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
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closePicker();
    };
    const handleFocus = (e: FocusEvent) => {
      const nextTarget = e.target as Node | null;
      if (
        nextTarget &&
        !buttonRef.current?.contains(nextTarget) &&
        !menuRef.current?.contains(nextTarget)
      ) {
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
    const handleModalOpen = () => closePicker(false);
    window.addEventListener("overlay:modal-open", handleModalOpen as EventListener);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("overlay:modal-open", handleModalOpen as EventListener);
    };
  }, [open, closePicker]);

  useEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    setMenuStyle({
      position: "fixed",
      top: 0,
      left: 0,
      visibility: "hidden",
    });
  }, [open]);

  const updateMenuPosition = useCallback(() => {
    const anchor = buttonRef.current;
    const menu = menuRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const measured = menu?.getBoundingClientRect();
    const menuWidth = measured?.width ?? menu?.offsetWidth ?? 176;
    const menuHeight = measured?.height ?? menu?.offsetHeight ?? 140;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const padding = 8;
    let left = rect.left;
    let top = rect.bottom + padding;

    if (left + menuWidth + padding > viewportWidth) {
      left = Math.max(padding, viewportWidth - menuWidth - padding);
    }

    if (top + menuHeight + padding > viewportHeight && rect.top - menuHeight - padding > 0) {
      top = rect.top - menuHeight - padding;
    }

    setMenuStyle({
      position: "fixed",
      top,
      left,
      visibility: "visible",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const rafId = window.requestAnimationFrame(updateMenuPosition);
    return () => window.cancelAnimationFrame(rafId);
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const handleScroll = () => updateMenuPosition();
    const handleResize = () => updateMenuPosition();
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, updateMenuPosition]);

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
      <div className="w-px self-stretch bg-[var(--border-subtle)]" />

      {canEdit && open && menuStyle && (
        <Portal>
          <div
            id={pickerId}
            ref={menuRef}
            style={menuStyle}
            className="pointer-events-auto z-[1001] w-44 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2.5 shadow-lg"
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
                  className={`h-8 w-8 cursor-pointer rounded transition-transform hover:scale-110 ${c === color ? "ring-2 ring-[var(--fg-primary)] ring-offset-2 ring-offset-[var(--bg-elevated)]" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={c === color ? `Current color ${c}` : `Set color to ${c}`}
                />
              ))}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
