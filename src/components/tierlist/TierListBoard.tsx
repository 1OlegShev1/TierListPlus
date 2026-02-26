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
import { useAutoAnimate } from "@formkit/auto-animate/react";
import type { AutoAnimationPlugin } from "@formkit/auto-animate";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTierListStore } from "@/hooks/useTierList";
import { apiPatch, apiPost, getErrorMessage } from "@/lib/api-client";
import { TIER_COLORS } from "@/lib/constants";
import type { Item, TierConfig } from "@/types";
import { DraggableItem } from "./DraggableItem";
import { TierRow } from "./TierRow";
import { UnrankedDropZone, UnrankedHeader } from "./UnrankedPool";

/**
 * Custom auto-animate plugin for tier row animations.
 *
 * The default add animation is nearly invisible (2% scale + delayed opacity fade).
 * The default move has a heuristic that zeros out deltas when edges don't shift,
 * which can suppress animations for full-width rows.
 */
const tierRowAnimation: AutoAnimationPlugin = (el, action, coordsA, coordsB) => {
  if (action === "add") {
    return new KeyframeEffect(
      el,
      [
        { opacity: 0, transform: "translateY(-10px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 250, easing: "ease-out" },
    );
  }

  if (action === "remove") {
    // Default styleReset (position:absolute) is applied automatically by auto-animate
    return new KeyframeEffect(
      el,
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.96)" },
      ],
      { duration: 200, easing: "ease-out" },
    );
  }

  // remain — FLIP slide from old position to new
  if (coordsA && coordsB) {
    const deltaX = coordsA.left - coordsB.left;
    const deltaY = coordsA.top - coordsB.top;
    if (deltaX !== 0 || deltaY !== 0) {
      return new KeyframeEffect(
        el,
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" },
        ],
        { duration: 300, easing: "ease-in-out" },
      );
    }
  }

  return new KeyframeEffect(el, [], { duration: 0 });
};

interface TierListBoardProps {
  sessionId: string;
  participantId: string;
  tierConfig: TierConfig[];
  sessionItems: Item[];
  seededTiers?: Record<string, string[]>;
  onSubmitted: () => void;
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
  const [animateRef, enableAnimate] = useAutoAnimate(tierRowAnimation);

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

  const handleMoveTier = useCallback((index: number, direction: -1 | 1) => {
    setTierConfig((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const updated = [...prev];
      [updated[index], updated[target]] = [updated[target], updated[index]];
      return updated.map((t, i) => ({ ...t, sortOrder: i }));
    });
  }, []);

  const handleInsertTier = useCallback(
    (atIndex: number) => {
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
    [addTierToStore],
  );

  const handleDeleteTier = useCallback(
    (key: string) => {
      setTierConfig((prev) => {
        if (prev.length <= 2) return prev;
        removeTierFromStore(key);
        return prev.filter((t) => t.key !== key).map((t, i) => ({ ...t, sortOrder: i }));
      });
    },
    [removeTierFromStore],
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
      enableAnimate(false);
      setActiveId(event.active.id as string);
    },
    [setActiveId, enableAnimate],
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
      enableAnimate(true);
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
        const newIndex = containerItems.indexOf(overId);

        if (oldIndex !== newIndex && oldIndex >= 0 && newIndex >= 0) {
          store.reorderInContainer(activeContainer, oldIndex, newIndex);
        }
      }
    },
    [enableAnimate, findContainer, setActiveId, tierConfig],
  );

  const handleDragCancel = useCallback(() => {
    enableAnimate(true);
    setActiveId(null);
  }, [enableAnimate, setActiveId]);

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
          <div ref={animateRef} className="rounded-lg border border-neutral-800">
            {tierConfig.map((tier, index) => (
              <TierRow
                key={tier.key}
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
