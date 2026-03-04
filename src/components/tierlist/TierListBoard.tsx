"use client";

import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { nanoid } from "nanoid";
import dynamic from "next/dynamic";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ImageUploader, type UploadedImage } from "@/components/shared/ImageUploader";
import { CloseIcon } from "@/components/ui/icons";
import { useTierListStore } from "@/hooks/useTierList";
import { useUser } from "@/hooks/useUser";
import { apiDelete, apiPatch, apiPost, getErrorMessage } from "@/lib/api-client";
import { TIER_COLORS } from "@/lib/constants";
import { clearDraft, getDraft, saveDraft } from "@/lib/vote-draft";
import type { Item, TierConfig } from "@/types";
import { DraggableItem } from "./DraggableItem";
import { EditableUnrankedItemCard } from "./EditableUnrankedItemCard";
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
  canSaveTemplate?: boolean;
  canManageItems?: boolean;
  templateIsHidden?: boolean;
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

function StatusNotice({
  tone,
  children,
  onDismiss,
}: {
  tone: "amber" | "emerald";
  children: ReactNode;
  onDismiss: () => void;
}) {
  const toneClassName =
    tone === "emerald"
      ? "border-emerald-500/40 text-emerald-100 shadow-[0_12px_36px_-22px_rgba(16,185,129,0.9)]"
      : "border-amber-500/40 text-amber-100 shadow-[0_12px_36px_-22px_rgba(245,158,11,0.95)]";
  const toneButtonClassName =
    tone === "emerald"
      ? "text-emerald-200/70 hover:bg-emerald-500/10 hover:text-emerald-100"
      : "text-amber-200/70 hover:bg-amber-500/10 hover:text-amber-100";

  return (
    <div
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-neutral-950/90 px-3 py-2 text-sm leading-5 backdrop-blur-sm sm:w-[22rem] ${toneClassName}`}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={onDismiss}
        className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-colors ${toneButtonClassName}`}
        aria-label="Dismiss notice"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function TierListBoard({
  sessionId,
  participantId,
  tierConfig: initialTierConfig,
  sessionItems,
  seededTiers,
  canEditTierConfig = false,
  canSaveTemplate = false,
  canManageItems = false,
  templateIsHidden = false,
  onSubmitted,
}: TierListBoardProps) {
  const { userId, isLoading: userLoading, error: userError } = useUser();
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
    appendItem,
    updateItem,
    removeItem,
  } = useTierListStore();

  const [tierConfig, setTierConfig] = useState<TierConfig[]>(initialTierConfig);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [bracketSeeded, setBracketSeeded] = useState(false);
  const [showSessionBracket, setShowSessionBracket] = useState(false);
  const [creatingItemCount, setCreatingItemCount] = useState(0);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [itemMutationError, setItemMutationError] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveTemplateError, setSaveTemplateError] = useState<string | null>(null);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [showSavedTemplateNotice, setShowSavedTemplateNotice] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  // ---- FLIP refs ----
  const containerRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<{ positions: Map<string, DOMRect>; keys: Set<string> } | null>(null);
  const skipFlipRef = useRef(false);
  const createItemQueueRef = useRef<Promise<void>>(Promise.resolve());
  const uploadingFilesRef = useRef(false);
  const mountedRef = useRef(true);
  const latestSessionIdRef = useRef(sessionId);

  useEffect(() => {
    latestSessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
  // MouseSensor for desktop (mouse events only — never fires on touch).
  // TouchSensor for mobile (touch events — can call preventDefault on
  //   touchmove to stop scrolling after activation, unlike PointerSensor).
  // Items use touch-action:manipulation so native scroll works during the
  // delay period; once the 200ms hold activates, TouchSensor prevents scroll.

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 8 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  // Suppress window resize (mobile address bar show/hide) from canceling
  // an active drag — dnd-kit calls handleCancel on every resize event.
  // See: https://github.com/clauderic/dnd-kit/issues/686
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  useEffect(() => {
    const suppress = (e: Event) => {
      if (activeIdRef.current) e.stopImmediatePropagation();
    };
    window.addEventListener("resize", suppress, true);
    return () => window.removeEventListener("resize", suppress, true);
  }, []);

  useEffect(() => {
    if (!expandedItemId) return;

    const collapseExpanded = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('[data-peek-item="true"]')) return;
      setExpandedItemId(null);
    };

    document.addEventListener("pointerdown", collapseExpanded, true);
    return () => document.removeEventListener("pointerdown", collapseExpanded, true);
  }, [expandedItemId]);

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection(args);
  }, []);

  const handleExpandItem = useCallback((itemId: string) => {
    setExpandedItemId(itemId);
  }, []);

  const handleCollapseExpanded = useCallback(() => {
    setExpandedItemId(null);
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setExpandedItemId(null);
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

      // Avoid mutating back into the unranked container while hovering its empty space.
      // On mobile, that path can cause the source/target layouts to oscillate and recurse.
      if (isOverContainer && overContainer === "unranked") return;

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

      if (activeContainer !== overContainer) {
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
        return;
      }

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
    if (uploadingFilesRef.current || isUploadingFiles) {
      setSubmitError("Wait for uploads to finish before locking in ranking.");
      return;
    }
    if (creatingItemCount > 0) {
      setSubmitError("Wait for item uploads to finish before locking in ranking.");
      return;
    }
    if (savingItemId || removingItemId) {
      setSubmitError("Finish item changes before locking in ranking.");
      return;
    }

    // Flush any pending tier config save
    if (canEditTierConfig && saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      try {
        await apiPatch(`/api/sessions/${sessionId}`, { tierConfig });
      } catch (err) {
        setSubmitError(getErrorMessage(err, "Failed to save tier changes. Please try again."));
        return;
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

  const handleUploadStateChange = useCallback(
    (uploading: boolean) => {
      if (!mountedRef.current || latestSessionIdRef.current !== sessionId) return;
      uploadingFilesRef.current = uploading;
      setIsUploadingFiles(uploading);
    },
    [sessionId],
  );

  const cleanupAbandonedUpload = useCallback(async (imageUrl: string) => {
    try {
      await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
    } catch {
      // Best-effort cleanup only. Server-side sweep still handles leftovers.
    }
  }, []);

  const handleUploadedImage = useCallback(
    ({ url, suggestedLabel }: UploadedImage) => {
      const requestSessionId = sessionId;
      if (
        !canManageItems ||
        submitting ||
        submitted ||
        !mountedRef.current ||
        latestSessionIdRef.current !== requestSessionId
      ) {
        void cleanupAbandonedUpload(url);
        return;
      }

      setCreatingItemCount((count) => count + 1);
      setItemMutationError(null);

      const createItem = async () => {
        try {
          const item = await apiPost<Item>(`/api/sessions/${sessionId}/items`, {
            label: suggestedLabel.trim(),
            imageUrl: url,
          });
          if (!mountedRef.current || latestSessionIdRef.current !== requestSessionId) {
            void cleanupAbandonedUpload(url);
            return;
          }
          appendItem(item);
        } catch (err) {
          void cleanupAbandonedUpload(url);
          if (!mountedRef.current || latestSessionIdRef.current !== requestSessionId) return;
          setItemMutationError(getErrorMessage(err, "Failed to add item"));
        } finally {
          if (mountedRef.current && latestSessionIdRef.current === requestSessionId) {
            setCreatingItemCount((count) => Math.max(0, count - 1));
          }
        }
      };

      createItemQueueRef.current = createItemQueueRef.current
        .catch(() => undefined)
        .then(createItem);
    },
    [appendItem, canManageItems, cleanupAbandonedUpload, sessionId, submitted, submitting],
  );

  const handleSaveLiveItemLabel = useCallback(
    async (itemId: string, label: string) => {
      const requestSessionId = sessionId;
      if (
        !canManageItems ||
        savingItemId ||
        removingItemId ||
        submitting ||
        submitted ||
        !mountedRef.current ||
        latestSessionIdRef.current !== requestSessionId
      ) {
        return false;
      }

      setSavingItemId(itemId);
      setItemMutationError(null);
      try {
        const item = await apiPatch<Item>(`/api/sessions/${sessionId}/items/${itemId}`, {
          label,
        });
        if (!mountedRef.current || latestSessionIdRef.current !== requestSessionId) return false;
        updateItem(item);
        return true;
      } catch (err) {
        if (!mountedRef.current || latestSessionIdRef.current !== requestSessionId) return false;
        setItemMutationError(getErrorMessage(err, "Failed to update item"));
        return false;
      } finally {
        if (mountedRef.current && latestSessionIdRef.current === requestSessionId) {
          setSavingItemId(null);
        }
      }
    },
    [canManageItems, removingItemId, savingItemId, sessionId, submitted, submitting, updateItem],
  );

  const handleRemoveLiveItem = async (itemId: string) => {
    const requestSessionId = sessionId;
    if (
      !canManageItems ||
      removingItemId ||
      savingItemId ||
      submitting ||
      submitted ||
      !mountedRef.current ||
      latestSessionIdRef.current !== requestSessionId
    ) {
      return;
    }

    setRemovingItemId(itemId);
    setItemMutationError(null);
    try {
      await apiDelete(`/api/sessions/${sessionId}/items/${itemId}`);
      if (!mountedRef.current || latestSessionIdRef.current !== requestSessionId) return;
      removeItem(itemId);
    } catch (err) {
      if (!mountedRef.current || latestSessionIdRef.current !== requestSessionId) return;
      setItemMutationError(getErrorMessage(err, "Failed to remove item"));
    } finally {
      if (mountedRef.current && latestSessionIdRef.current === requestSessionId) {
        setRemovingItemId(null);
      }
    }
  };

  const handleSaveTemplate = async () => {
    if (!canSaveTemplate || savingTemplate) return;
    if (hasPendingItemMutations) {
      setSaveTemplateError("Finish item changes before saving this list.");
      return;
    }

    setSavingTemplate(true);
    setSaveTemplateError(null);
    try {
      const result = await apiPost<{ id: string }>(`/api/sessions/${sessionId}/template`, {});
      setSavedTemplateId(result.id);
      setShowSavedTemplateNotice(true);
    } catch (err) {
      setSaveTemplateError(getErrorMessage(err, "Could not save this list"));
    } finally {
      setSavingTemplate(false);
    }
  };

  const activeItem = activeId ? items.get(activeId) : null;
  const liveItems = initializedRef.current ? Array.from(items.values()) : sessionItems;
  const totalItems = liveItems.length;
  const hasPendingItemMutations =
    isUploadingFiles || creatingItemCount > 0 || !!savingItemId || !!removingItemId;
  const savesWorkingTemplate = canEditTierConfig && templateIsHidden;
  const saveTemplateActionLabel = savesWorkingTemplate ? "Publish to Lists" : "Save as New List";
  const saveTemplateMobileLabel = savesWorkingTemplate ? "Publish" : "Save List";
  const openSavedTemplateLabel = savesWorkingTemplate ? "Open Published List" : "Open Saved List";
  const openSavedTemplateMobileLabel = "Open";
  const uploadsDisabled = userLoading || !userId || submitting || submitted;
  const unrankedEmptyMessage =
    totalItems === 0
      ? canManageItems
        ? "Upload items, then drag them into tiers."
        : canEditTierConfig
          ? "This vote can't edit items. Start a new vote to change the lineup."
          : "Waiting for the vote host to add items."
      : "All items ranked!";
  const uploadCard = canManageItems ? (
    <div className="w-[112px] flex-shrink-0 rounded-lg border border-neutral-700 bg-neutral-950 p-1.5 sm:w-[120px] md:w-[128px]">
      <ImageUploader
        onUploaded={handleUploadedImage}
        onUploadStateChange={handleUploadStateChange}
        multiple
        idleLabel={
          userLoading
            ? "Getting ready..."
            : uploadsDisabled
              ? "Device needed"
              : creatingItemCount > 0
                ? "Adding..."
                : "Upload"
        }
        disabled={uploadsDisabled}
        className="aspect-square w-full"
      />
      <div aria-hidden="true" className="mt-1 h-[30px]" />
    </div>
  ) : null;

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

  useEffect(() => {
    if (!showSavedTemplateNotice) return;
    const t = setTimeout(() => setShowSavedTemplateNotice(false), 5000);
    return () => clearTimeout(t);
  }, [showSavedTemplateNotice]);

  return (
    <div className="relative flex flex-col">
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 flex justify-center sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:z-30 sm:justify-end"
      >
        <div className="flex w-full max-w-[22rem] flex-col gap-2">
          {draftRestored && (
            <StatusNotice tone="amber" onDismiss={() => setDraftRestored(false)}>
              Draft restored.
            </StatusNotice>
          )}
          {bracketSeeded && (
            <StatusNotice tone="emerald" onDismiss={() => setBracketSeeded(false)}>
              Bracket seed applied. You can still move anything before locking it in.
            </StatusNotice>
          )}
          {savedTemplateId && showSavedTemplateNotice && (
            <StatusNotice tone="emerald" onDismiss={() => setShowSavedTemplateNotice(false)}>
              {savesWorkingTemplate ? "List published." : "List saved."}{" "}
              <Link
                href={`/templates/${savedTemplateId}`}
                className="font-medium underline underline-offset-2 hover:text-white"
              >
                Open it
              </Link>
            </StatusNotice>
          )}
        </div>
      </div>
      <div className="mb-2 space-y-2 sm:mb-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {totalItems >= 2 && (
            <button
              type="button"
              onClick={() => {
                if (hasPendingItemMutations) {
                  setItemMutationError("Finish item changes before opening Quick Bracket.");
                  return;
                }
                setItemMutationError(null);
                setShowSessionBracket(true);
              }}
              disabled={submitting || hasPendingItemMutations}
              className="rounded-lg border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-amber-400 hover:text-amber-300 disabled:opacity-50 sm:px-4 sm:py-1.5"
            >
              <span className="sm:hidden">Bracket</span>
              <span className="hidden sm:inline">Quick Bracket</span>
            </button>
          )}
          {canSaveTemplate &&
            (savedTemplateId ? (
              <Link
                href={`/templates/${savedTemplateId}`}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200 transition-colors hover:border-emerald-400 hover:text-emerald-100 sm:px-4 sm:py-1.5"
              >
                <span className="sm:hidden">{openSavedTemplateMobileLabel}</span>
                <span className="hidden sm:inline">{openSavedTemplateLabel}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={savingTemplate || hasPendingItemMutations}
                className="rounded-lg border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-50 sm:px-4 sm:py-1.5"
              >
                <span className="sm:hidden">
                  {savingTemplate ? "Saving" : saveTemplateMobileLabel}
                </span>
                <span className="hidden sm:inline">
                  {savingTemplate ? "Saving..." : saveTemplateActionLabel}
                </span>
              </button>
            ))}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              submitting ||
              hasPendingItemMutations ||
              totalItems === 0 ||
              rankedCount !== totalItems
            }
            className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-50 sm:px-5 sm:py-1.5"
          >
            <span className="sm:hidden">{submitting ? "Saving" : "Save"}</span>
            <span className="hidden sm:inline">{submitting ? "Saving..." : "Lock In Ranking"}</span>
          </button>
        </div>
        {saveTemplateError && (
          <p className="text-right text-sm text-red-400">{saveTemplateError}</p>
        )}
        {submitError && <p className="text-right text-sm text-red-400">{submitError}</p>}
        {userError && canManageItems && (
          <p className="text-right text-sm text-red-400">{userError}</p>
        )}
        {itemMutationError && (
          <p className="text-right text-sm text-red-400">{itemMutationError}</p>
        )}
      </div>
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
                expandedItemId={canManageItems ? null : expandedItemId}
                onExpandItem={canManageItems ? () => {} : handleExpandItem}
                onCollapseExpanded={canManageItems ? () => {} : handleCollapseExpanded}
              />
            </div>
          ))}
        </div>

        {/* Unranked Pool */}
        <div className="flex-shrink-0 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:pb-0">
          <div className="mb-2 flex items-center justify-between">
            <UnrankedHeader />
            <span className="text-xs text-neutral-500 sm:text-sm">
              {rankedCount}/{totalItems} ranked
            </span>
          </div>
          <UnrankedDropZone
            emptyMessage={unrankedEmptyMessage}
            className="mb-2 max-h-none min-h-[112px]"
            onRemoveItem={!canManageItems ? undefined : handleRemoveLiveItem}
            removingItemId={removingItemId}
            renderItem={
              canManageItems
                ? (item) => (
                    <EditableUnrankedItemCard
                      key={item.id}
                      id={item.id}
                      label={item.label}
                      imageUrl={item.imageUrl}
                      onSaveLabel={handleSaveLiveItemLabel}
                      onRemove={() => {
                        void handleRemoveLiveItem(item.id);
                      }}
                      saving={savingItemId === item.id}
                      removing={removingItemId === item.id}
                    />
                  )
                : undefined
            }
            afterItems={uploadCard ?? undefined}
          />
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
          items={liveItems}
          onComplete={(rankedIds) => {
            const seeded = seedTiersFromRanking(rankedIds, tierConfig);
            initialize(
              liveItems,
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
