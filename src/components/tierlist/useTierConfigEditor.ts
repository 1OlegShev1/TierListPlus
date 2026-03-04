"use client";

import { nanoid } from "nanoid";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { apiPatch } from "@/lib/api-client";
import { TIER_COLORS } from "@/lib/constants";
import type { TierConfig } from "@/types";

interface UseTierConfigEditorArgs {
  initialTierConfig: TierConfig[];
  canEditTierConfig: boolean;
  sessionId: string;
  addTierToStore: (key: string) => void;
  removeTierFromStore: (key: string) => void;
}

/** Snapshot positions of all direct children keyed by data-tier-key. */
function snapshotPositions(container: HTMLElement): Map<string, DOMRect> {
  const map = new Map<string, DOMRect>();
  for (const child of container.children) {
    const key = (child as HTMLElement).dataset.tierKey;
    if (key) map.set(key, child.getBoundingClientRect());
  }
  return map;
}

/** Play FLIP move/add animations by comparing old vs new positions. */
function flipAnimate(
  container: HTMLElement,
  oldPositions: Map<string, DOMRect>,
  oldKeys: Set<string>,
) {
  for (const child of container.children) {
    const el = child as HTMLElement;
    const key = el.dataset.tierKey;
    if (!key) continue;

    const newRect = el.getBoundingClientRect();
    const oldRect = oldPositions.get(key);

    if (oldKeys.has(key) && oldRect) {
      // Existing row — animate if it moved
      const dy = oldRect.top - newRect.top;
      if (Math.abs(dy) > 1) {
        el.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], {
          duration: 300,
          easing: "ease-in-out",
        });
      }
    } else if (!oldKeys.has(key)) {
      // New row — slide in
      el.animate(
        [
          { opacity: 0, transform: "translateY(-10px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 250, easing: "ease-out" },
      );
    }
  }
}

export function useTierConfigEditor({
  initialTierConfig,
  canEditTierConfig,
  sessionId,
  addTierToStore,
  removeTierFromStore,
}: UseTierConfigEditorArgs) {
  const [tierConfig, setTierConfig] = useState<TierConfig[]>(initialTierConfig);

  const containerRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<{ positions: Map<string, DOMRect>; keys: Set<string> } | null>(null);
  const skipFlipRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeleteTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const isFirstConfigRef = useRef(true);

  const captureFlip = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    flipRef.current = {
      positions: snapshotPositions(element),
      keys: new Set(
        Array.from(element.children).map((c) => (c as HTMLElement).dataset.tierKey ?? ""),
      ),
    };
  }, []);

  useLayoutEffect(() => {
    const snap = flipRef.current;
    flipRef.current = null;
    if (skipFlipRef.current) {
      skipFlipRef.current = false;
      return;
    }
    if (!snap || !containerRef.current) return;
    flipAnimate(containerRef.current, snap.positions, snap.keys);
  });

  useEffect(() => {
    if (!canEditTierConfig) return;
    if (isFirstConfigRef.current) {
      isFirstConfigRef.current = false;
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await apiPatch(`/api/sessions/${sessionId}`, { tierConfig });
      } catch (error) {
        console.error("Failed to auto-save tier config:", error);
      }
    }, 800);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [canEditTierConfig, sessionId, tierConfig]);

  useEffect(() => {
    return () => {
      for (const timeout of pendingDeleteTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      pendingDeleteTimeoutsRef.current.clear();
    };
  }, []);

  const flushPendingTierConfigSave = useCallback(async () => {
    if (!canEditTierConfig || !saveTimeoutRef.current) return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;
    await apiPatch(`/api/sessions/${sessionId}`, { tierConfig });
  }, [canEditTierConfig, sessionId, tierConfig]);

  const handleLabelChange = useCallback(
    (key: string, newLabel: string) => {
      if (!canEditTierConfig) return;
      setTierConfig((prev) =>
        prev.map((tier) => (tier.key === key ? { ...tier, label: newLabel } : tier)),
      );
    },
    [canEditTierConfig],
  );

  const handleColorChange = useCallback(
    (key: string, newColor: string) => {
      if (!canEditTierConfig) return;
      setTierConfig((prev) =>
        prev.map((tier) => (tier.key === key ? { ...tier, color: newColor } : tier)),
      );
    },
    [canEditTierConfig],
  );

  const handleMoveTier = useCallback(
    (index: number, direction: -1 | 1) => {
      if (!canEditTierConfig) return;
      captureFlip();
      setTierConfig((prev) => {
        const target = index + direction;
        if (target < 0 || target >= prev.length) return prev;
        const updated = [...prev];
        [updated[index], updated[target]] = [updated[target], updated[index]];
        return updated.map((tier, i) => ({ ...tier, sortOrder: i }));
      });
    },
    [canEditTierConfig, captureFlip],
  );

  const handleInsertTier = useCallback(
    (atIndex: number) => {
      if (!canEditTierConfig) return;
      captureFlip();
      const newKey = `t_${nanoid(4)}`;
      setTierConfig((prev) => {
        const nextColor = TIER_COLORS[prev.length % TIER_COLORS.length];
        const newTier: TierConfig = {
          key: newKey,
          label: `Tier ${prev.length + 1}`,
          color: nextColor,
          sortOrder: 0,
        };
        const updated = [...prev];
        updated.splice(atIndex, 0, newTier);
        return updated.map((tier, i) => ({ ...tier, sortOrder: i }));
      });
      addTierToStore(newKey);
    },
    [addTierToStore, canEditTierConfig, captureFlip],
  );

  const handleDeleteTier = useCallback(
    (key: string) => {
      if (!canEditTierConfig) return;
      if (tierConfig.length <= 2) return;
      if (pendingDeleteTimeoutsRef.current.has(key)) return;

      const container = containerRef.current;
      if (!container) return;

      // Snapshot before anything changes
      const oldPositions = snapshotPositions(container);

      // Find the row to delete
      const target = Array.from(container.children).find(
        (child) => (child as HTMLElement).dataset.tierKey === key,
      ) as HTMLElement | undefined;

      if (!target) return;

      // Pull it out of flow so siblings collapse
      const rect = target.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      Object.assign(target.style, {
        position: "absolute",
        top: `${rect.top - containerRect.top + container.scrollTop}px`,
        left: "0",
        right: "0",
        zIndex: "10",
        pointerEvents: "none",
      });

      // Fade it out
      target.animate(
        [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0, transform: "scale(0.96)" },
        ],
        { duration: 200, easing: "ease-out", fill: "forwards" },
      );

      // FLIP siblings into their new positions
      for (const child of container.children) {
        const element = child as HTMLElement;
        if (element === target) continue;
        const tierKey = element.dataset.tierKey;
        if (!tierKey) continue;
        const oldRect = oldPositions.get(tierKey);
        if (!oldRect) continue;
        const newRect = element.getBoundingClientRect();
        const dy = oldRect.top - newRect.top;
        if (Math.abs(dy) > 1) {
          element.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], {
            duration: 300,
            easing: "ease-in-out",
          });
        }
      }

      // After animation, actually remove from state
      const timeout = setTimeout(() => {
        skipFlipRef.current = true;
        removeTierFromStore(key);
        setTierConfig((prev) =>
          prev.filter((tier) => tier.key !== key).map((tier, i) => ({ ...tier, sortOrder: i })),
        );
        pendingDeleteTimeoutsRef.current.delete(key);
      }, 300);
      pendingDeleteTimeoutsRef.current.set(key, timeout);
    },
    [canEditTierConfig, removeTierFromStore, tierConfig.length],
  );

  return {
    tierConfig,
    containerRef,
    handleLabelChange,
    handleColorChange,
    handleMoveTier,
    handleInsertTier,
    handleDeleteTier,
    flushPendingTierConfigSave,
  };
}
