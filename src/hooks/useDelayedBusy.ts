"use client";

import { useEffect, useRef, useState } from "react";

interface UseDelayedBusyOptions {
  showDelayMs?: number;
  minVisibleMs?: number;
}

export function useDelayedBusy(
  busy: boolean,
  { showDelayMs = 180, minVisibleMs = 0 }: UseDelayedBusyOptions = {},
) {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (busy) {
      if (visible) return;

      if (showDelayMs <= 0) {
        shownAtRef.current = Date.now();
        setVisible(true);
        return;
      }

      showTimeoutRef.current = setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
        showTimeoutRef.current = null;
      }, showDelayMs);
      return;
    }

    if (!visible) {
      shownAtRef.current = null;
      return;
    }

    const elapsed = shownAtRef.current ? Date.now() - shownAtRef.current : minVisibleMs;
    const remaining = Math.max(0, minVisibleMs - elapsed);

    if (remaining === 0) {
      shownAtRef.current = null;
      setVisible(false);
      return;
    }

    hideTimeoutRef.current = setTimeout(() => {
      shownAtRef.current = null;
      setVisible(false);
      hideTimeoutRef.current = null;
    }, remaining);
  }, [busy, minVisibleMs, showDelayMs, visible]);

  return visible;
}
