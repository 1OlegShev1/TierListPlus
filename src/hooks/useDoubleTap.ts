import { type PointerEvent as ReactPointerEvent, useRef } from "react";

export const DOUBLE_TAP_WINDOW_MS = 450;

interface UseDoubleTapOptions<K> {
  onDoubleTap: (key: K) => void;
  enabled?: (key: K) => boolean;
  windowMs?: number;
}

/**
 * Discriminates a single tap (toggle preview) from a double tap (open source).
 * Touch has no native dblclick, so onPointerUp measures the gap between taps and
 * arms a skip flag; pair with the element's onDoubleClick for mouse.
 */
export function useDoubleTap<K extends string | number>({
  onDoubleTap,
  enabled,
  windowMs = DOUBLE_TAP_WINDOW_MS,
}: UseDoubleTapOptions<K>) {
  const lastTapRef = useRef<{ key: K; at: number } | null>(null);
  const skipNextClickRef = useRef(false);

  const isEnabled = (key: K) => (enabled ? enabled(key) : true);

  const onPointerUp = (event: ReactPointerEvent, key: K) => {
    if (event.pointerType === "mouse" || !isEnabled(key)) return;

    const now = event.timeStamp;
    const lastTap = lastTapRef.current;
    if (lastTap && lastTap.key === key && now - lastTap.at <= windowMs) {
      lastTapRef.current = null;
      skipNextClickRef.current = true;
      event.preventDefault();
      event.stopPropagation();
      onDoubleTap(key);
      return;
    }

    lastTapRef.current = { key, at: now };
  };

  // Clear a stale skip flag so a click that never arrived can't swallow a future tap.
  const onPointerDown = () => {
    skipNextClickRef.current = false;
  };

  // Ignore a handled touch double-tap's synthesized click, or a mouse double-click's 2nd click.
  const shouldIgnoreClick = (event: { detail: number }) => {
    if (skipNextClickRef.current) {
      skipNextClickRef.current = false;
      return true;
    }
    return event.detail >= 2;
  };

  return { onPointerUp, onPointerDown, shouldIgnoreClick };
}
