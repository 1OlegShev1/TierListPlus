"use client";

import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTierListStore } from "@/hooks/useTierList";
import { apiPatch, apiPost, getErrorMessage } from "@/lib/api-client";
import { TIER_COLORS } from "@/lib/constants";
import type { Item, TierConfig } from "@/types";
import { DraggableItem } from "./DraggableItem";
import { TierRow } from "./TierRow";
import { UnrankedDropZone, UnrankedHeader } from "./UnrankedPool";

interface TierListBoardProps {
  sessionId: string;
  participantId: string;
  tierConfig: TierConfig[];
  sessionItems: Item[];
  seededTiers?: Record<string, string[]>;
  onSubmitted: () => void;
}

// ---- FLIP animation helpers ----

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
        el.animate(
          [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
          { duration: 300, easing: "ease-in-out" },
        );
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

export function TierListBoard({
  sessionId,
  participantId,
  tierConfig: initialTierConfig,
  sessionItems,
  seededTiers,
  onSubmitted,
}: TierListBoardProps) {
  const {
    initialize,
    setActiveId,
    activeId,
    items,
    findContainer,
    tiers,
    getVotes,
    addTier: addTierToStore,
    removeTier: removeTierFromStore,
  } = useTierListStore();

  const [tierConfig, setTierConfig] = useState<TierConfig[]>(initialTierConfig);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ---- FLIP refs ----
  const containerRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<{ positions: Map<string, DOMRect>; keys: Set<string> } | null>(null);
  const skipFlipRef = useRef(false);

  /** Call before any setTierConfig to snapshot current positions. */
  const captureFlip = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    flipRef.current = {
      positions: snapshotPositions(el),
      keys: new Set(Array.from(el.children).map((c) => (c as HTMLElement).dataset.tierKey!)),
    };
  }, []);

  /** After React commits the DOM, run the FLIP animation. */
  useLayoutEffect(() => {
    const snap = flipRef.current;
    flipRef.current = null;
    if (skipFlipRef.current) {
      skipFlipRef.current = false;
      return;
    }
    if (!snap || !containerRef.current) return;
    flipAnimate(containerRef.current, snap.positions, snap.keys);
  }, [tierConfig]);

  // Initialize Zustand store only once on mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    initialize(
      sessionItems,
      initialTierConfig.map((t) => t.key),
      seededTiers,
    );
  }, [sessionItems, initialTierConfig, seededTiers, initialize]);

  // ---- Debounced auto-save ----
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save tierConfig when it changes (skip the initial value)
  const isFirstConfigRef = useRef(true);
  useEffect(() => {
    if (isFirstConfigRef.current) {
      isFirstConfigRef.current = false;
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await apiPatch(`/api/sessions/${sessionId}`, { tierConfig });
      } catch (err) {
        console.error("Failed to auto-save tier config:", err);
      }
    }, 800);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [tierConfig, sessionId]);

  // ---- Tier mutation handlers ----

  const handleLabelChange = useCallback((key: string, newLabel: string) => {
    setTierConfig((prev) => prev.map((t) => (t.key === key ? { ...t, label: newLabel } : t)));
  }, []);

  const handleColorChange = useCallback((key: string, newColor: string) => {
    setTierConfig((prev) => prev.map((t) => (t.key === key ? { ...t, color: newColor } : t)));
  }, []);

  const handleMoveTier = useCallback(
    (index: number, direction: -1 | 1) => {
      captureFlip();
      setTierConfig((prev) => {
        const target = index + direction;
        if (target < 0 || target >= prev.length) return prev;
        const updated = [...prev];
        [updated[index], updated[target]] = [updated[target], updated[index]];
        return updated.map((t, i) => ({ ...t, sortOrder: i }));
      });
    },
    [captureFlip],
  );

  const handleInsertTier = useCallback(
    (atIndex: number) => {
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
        return updated.map((t, i) => ({ ...t, sortOrder: i }));
      });
      addTierToStore(newKey);
    },
    [addTierToStore, captureFlip],
  );

  const handleDeleteTier = useCallback(
    (key: string) => {
      if (tierConfig.length <= 2) return;

      const container = containerRef.current;
      if (!container) return;

      // Snapshot before anything changes
      const oldPositions = snapshotPositions(container);

      // Find the row to delete
      const target = Array.from(container.children).find(
        (c) => (c as HTMLElement).dataset.tierKey === key,
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
        const el = child as HTMLElement;
        if (el === target) continue;
        const k = el.dataset.tierKey;
        if (!k) continue;
        const oldRect = oldPositions.get(k);
        if (!oldRect) continue;
        const newRect = el.getBoundingClientRect();
        const dy = oldRect.top - newRect.top;
        if (Math.abs(dy) > 1) {
          el.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], {
            duration: 300,
            easing: "ease-in-out",
          });
        }
      }

      // After animation, actually remove from state
      setTimeout(() => {
        skipFlipRef.current = true;
        removeTierFromStore(key);
        setTierConfig((prev) =>
          prev.filter((t) => t.key !== key).map((t, i) => ({ ...t, sortOrder: i })),
        );
      }, 300);
    },
    [tierConfig.length, removeTierFromStore],
  );

  // ---- Drag and drop ----

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection(args);
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
    },
    [setActiveId],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeContainer = findContainer(activeId);
      const isOverContainer = overId === "unranked" || tierConfig.some((t) => t.key === overId);
      const overContainer = isOverContainer ? overId : findContainer(overId);

      if (!activeContainer || !overContainer || activeContainer === overContainer) return;

      const store = useTierListStore.getState();
      const overItems =
        overContainer === "unranked" ? store.unranked : (store.tiers[overContainer] ?? []);

      let newIndex: number;
      if (isOverContainer) {
        newIndex = overItems.length;
      } else {
        const overIndex = overItems.indexOf(overId);
        newIndex = overIndex >= 0 ? overIndex : overItems.length;
      }

      store.moveItem(activeId, overContainer, newIndex);
    },
    [findContainer, tierConfig],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeContainer = findContainer(activeId);
      const isOverContainer = overId === "unranked" || tierConfig.some((t) => t.key === overId);
      const overContainer = isOverContainer ? overId : findContainer(overId);

      if (!activeContainer || !overContainer) return;

      if (activeContainer === overContainer) {
        const store = useTierListStore.getState();
        const containerItems =
          activeContainer === "unranked" ? store.unranked : (store.tiers[activeContainer] ?? []);

        const oldIndex = containerItems.indexOf(activeId);

        // Dropped on the container itself (empty space) — move to end
        if (isOverContainer) {
          const lastIndex = containerItems.length - 1;
          if (oldIndex >= 0 && oldIndex !== lastIndex) {
            store.reorderInContainer(activeContainer, oldIndex, lastIndex);
          }
          return;
        }

        const newIndex = containerItems.indexOf(overId);

        if (oldIndex !== newIndex && oldIndex >= 0 && newIndex >= 0) {
          store.reorderInContainer(activeContainer, oldIndex, newIndex);
        }
      }
    },
    [findContainer, setActiveId, tierConfig],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, [setActiveId]);

  // ---- Submit ----

  const handleSubmit = async () => {
    // Flush any pending tier config save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      try {
        await apiPatch(`/api/sessions/${sessionId}`, { tierConfig });
      } catch (err) {
        console.error("Failed to save tier config before submit:", err);
      }
    }

    const votes = getVotes();
    if (votes.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiPost(`/api/sessions/${sessionId}/votes`, { participantId, votes });
      onSubmitted();
    } catch (err) {
      setSubmitError(getErrorMessage(err, "Failed to submit votes. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const activeItem = activeId ? items.get(activeId) : null;
  const totalItems = sessionItems.length;
  const rankedCount = Object.values(tiers).reduce((sum, ids) => sum + ids.length, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Tier Rows — scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div ref={containerRef} className="relative rounded-lg border border-neutral-800">
            {tierConfig.map((tier, index) => (
              <div key={tier.key} data-tier-key={tier.key}>
                <TierRow
                  tierKey={tier.key}
                  label={tier.label}
                  color={tier.color}
                  isFirst={index === 0}
                  isLast={index === tierConfig.length - 1}
                  canDelete={tierConfig.length > 2}
                  onLabelChange={(newLabel) => handleLabelChange(tier.key, newLabel)}
                  onColorChange={(newColor) => handleColorChange(tier.key, newColor)}
                  onMoveUp={() => handleMoveTier(index, -1)}
                  onMoveDown={() => handleMoveTier(index, 1)}
                  onInsertAbove={() => handleInsertTier(index)}
                  onInsertBelow={() => handleInsertTier(index + 1)}
                  onDelete={() => handleDeleteTier(tier.key)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Unranked Pool + Submit — always visible */}
        <div className="flex-shrink-0 pt-2">
          <div className="mb-1.5 flex items-center justify-between">
            <UnrankedHeader />
            <div className="flex items-center gap-3">
              <span className="text-sm text-neutral-500">
                {rankedCount}/{totalItems} ranked
              </span>
              <button
                onClick={handleSubmit}
                disabled={submitting || rankedCount === 0}
                className="rounded-lg bg-amber-500 px-5 py-1.5 text-sm font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Votes"}
              </button>
            </div>
          </div>
          {submitError && <p className="mb-1 text-sm text-red-400">{submitError}</p>}
          <UnrankedDropZone />
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeItem ? (
            <DraggableItem
              id={activeItem.id}
              label={activeItem.label}
              imageUrl={activeItem.imageUrl}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
