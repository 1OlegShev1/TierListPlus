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
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { nanoid } from "nanoid";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTierListStore } from "@/hooks/useTierList";
import { apiPatch, apiPost, getErrorMessage } from "@/lib/api-client";
import { TIER_COLORS } from "@/lib/constants";
import { clearDraft, getDraft, saveDraft } from "@/lib/vote-draft";
import type { Item, TierConfig } from "@/types";
import { DraggableItem } from "./DraggableItem";
import { TierRow } from "./TierRow";
import { UnrankedDropZone, UnrankedHeader } from "./UnrankedPool";

const BracketModal = dynamic(
  () => import("../bracket/BracketModal").then((mod) => mod.BracketModal),
  { ssr: false },
);

interface TierListBoardProps {
  sessionId: string;
  participantId: string;
  tierConfig: TierConfig[];
  sessionItems: Item[];
  seededTiers?: Record<string, string[]>;
  canEditTierConfig?: boolean;
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

/** Evenly distribute a ranked list across tiers from top to bottom. */
function seedTiersFromRanking(
  rankedIds: string[],
  tierConfig: TierConfig[],
): Record<string, string[]> {
  const sortedTiers = [...tierConfig].sort((a, b) => a.sortOrder - b.sortOrder);
  const tierCount = sortedTiers.length;
  const itemCount = rankedIds.length;
  const baseSize = Math.floor(itemCount / tierCount);
  const remainder = itemCount % tierCount;

  const seededTiers: Record<string, string[]> = {};
  let cursor = 0;

  for (let i = 0; i < tierCount; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    seededTiers[sortedTiers[i].key] = rankedIds.slice(cursor, cursor + size);
    cursor += size;
  }

  return seededTiers;
}

export function TierListBoard({
  sessionId,
  participantId,
  tierConfig: initialTierConfig,
  sessionItems,
  seededTiers,
  canEditTierConfig = false,
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
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [bracketSeeded, setBracketSeeded] = useState(false);
  const [showSessionBracket, setShowSessionBracket] = useState(false);
  const [isTouchInput, setIsTouchInput] = useState(false);

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
      keys: new Set(Array.from(el.children).map((c) => (c as HTMLElement).dataset.tierKey ?? "")),
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
  });

  // Initialize Zustand store only once on mount (restore draft if available)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const validIds = new Set(sessionItems.map((i) => i.id));
    const draft = getDraft(sessionId, participantId, validIds);

    initialize(
      sessionItems,
      initialTierConfig.map((t) => t.key),
      seededTiers,
      draft,
    );

    if (draft) setDraftRestored(true);
  }, [sessionItems, initialTierConfig, seededTiers, initialize, sessionId, participantId]);

  // Auto-save draft to localStorage on every tier/unranked change
  useEffect(() => {
    // Skip until store is initialized
    if (!initializedRef.current) return;

    let timeout: ReturnType<typeof setTimeout>;
    const unsub = useTierListStore.subscribe((state) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        saveDraft(sessionId, participantId, {
          tiers: state.tiers,
          unranked: state.unranked,
        });
      }, 300);
    });

    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, [sessionId, participantId]);

  // Warn before leaving with unsaved ranked items.
  // Disable this guard while submit is in-flight and after successful submit.
  const rankedCount = Object.values(tiers).reduce((sum, ids) => sum + ids.length, 0);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    if (rankedCount > 0 && !submitting && !submitted) {
      window.addEventListener("beforeunload", handler);
    }
    return () => window.removeEventListener("beforeunload", handler);
  }, [rankedCount, submitting, submitted]);

  // ---- Debounced auto-save ----
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save tierConfig when it changes (skip the initial value)
  const isFirstConfigRef = useRef(true);
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
      } catch (err) {
        console.error("Failed to auto-save tier config:", err);
      }
    }, 800);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [canEditTierConfig, tierConfig, sessionId]);

  // ---- Tier mutation handlers ----

  const handleLabelChange = useCallback(
    (key: string, newLabel: string) => {
      if (!canEditTierConfig) return;
      setTierConfig((prev) => prev.map((t) => (t.key === key ? { ...t, label: newLabel } : t)));
    },
    [canEditTierConfig],
  );

  const handleColorChange = useCallback(
    (key: string, newColor: string) => {
      if (!canEditTierConfig) return;
      setTierConfig((prev) => prev.map((t) => (t.key === key ? { ...t, color: newColor } : t)));
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
        return updated.map((t, i) => ({ ...t, sortOrder: i }));
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
        return updated.map((t, i) => ({ ...t, sortOrder: i }));
      });
      addTierToStore(newKey);
    },
    [addTierToStore, canEditTierConfig, captureFlip],
  );

  const handleDeleteTier = useCallback(
    (key: string) => {
      if (!canEditTierConfig) return;
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
    [canEditTierConfig, tierConfig.length, removeTierFromStore],
  );

  // ---- Drag and drop ----

  useEffect(() => {
    const coarseMedia = window.matchMedia("(hover: none) and (pointer: coarse)");
    const update = () => {
      const hasTouch = navigator.maxTouchPoints > 0;
      setIsTouchInput(coarseMedia.matches || hasTouch);
    };
    update();
    coarseMedia.addEventListener("change", update);
    return () => coarseMedia.removeEventListener("change", update);
  }, []);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 170,
      tolerance: 16,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(isTouchInput ? touchSensor : pointerSensor, keyboardSensor);

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
    if (canEditTierConfig && saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      try {
        await apiPatch(`/api/sessions/${sessionId}`, { tierConfig });
      } catch (err) {
        console.error("Failed to save tier config before submit:", err);
      }
    }

    const votes = getVotes();
    if (votes.length !== totalItems) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiPost(`/api/sessions/${sessionId}/votes`, { participantId, votes });
      clearDraft(sessionId, participantId);
      setSubmitted(true);
      onSubmitted();
    } catch (err) {
      setSubmitError(getErrorMessage(err, "Failed to submit votes. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const activeItem = activeId ? items.get(activeId) : null;
  const totalItems = sessionItems.length;

  // Auto-dismiss draft restored indicator
  useEffect(() => {
    if (!draftRestored) return;
    const t = setTimeout(() => setDraftRestored(false), 3000);
    return () => clearTimeout(t);
  }, [draftRestored]);

  useEffect(() => {
    if (!bracketSeeded) return;
    const t = setTimeout(() => setBracketSeeded(false), 3000);
    return () => clearTimeout(t);
  }, [bracketSeeded]);

  return (
    <div className="flex flex-col">
      {draftRestored && (
        <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-400">
          Draft restored from your previous session
        </div>
      )}
      {bracketSeeded && (
        <div className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-400">
          Bracket assist applied. You can freely move items before submitting.
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          ref={containerRef}
          className="relative rounded-lg border border-neutral-800 touch-pan-y"
        >
          {tierConfig.map((tier, index) => (
            <div key={tier.key} data-tier-key={tier.key}>
              <TierRow
                tierKey={tier.key}
                label={tier.label}
                color={tier.color}
                canEditTier={canEditTierConfig}
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

        {/* Unranked Pool + Submit — always visible */}
        <div className="flex-shrink-0 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:pb-0">
          <div className="mb-2 flex items-center justify-between">
            <UnrankedHeader />
            <span className="text-xs text-neutral-500 sm:text-sm">
              {rankedCount}/{totalItems} ranked
            </span>
          </div>
          <div className="mb-2 flex gap-2 rounded-lg border border-neutral-800 bg-neutral-950/95 p-2 sm:mb-1.5 sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
            {totalItems >= 2 && (
              <button
                onClick={() => setShowSessionBracket(true)}
                disabled={submitting}
                className="flex-1 rounded-lg border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-amber-400 hover:text-amber-300 disabled:opacity-50 sm:flex-none sm:px-4 sm:py-1.5"
              >
                Bracket Assist
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || rankedCount !== totalItems}
              className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-50 sm:flex-none sm:px-5 sm:py-1.5"
            >
              {submitting ? "Submitting..." : "Submit Votes"}
            </button>
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

      {showSessionBracket && (
        <BracketModal
          items={sessionItems}
          onComplete={(rankedIds) => {
            const seeded = seedTiersFromRanking(rankedIds, tierConfig);
            initialize(
              sessionItems,
              tierConfig.map((t) => t.key),
              seeded,
              null,
            );
            setBracketSeeded(true);
            setShowSessionBracket(false);
          }}
          onCancel={() => setShowSessionBracket(false)}
        />
      )}
    </div>
  );
}
