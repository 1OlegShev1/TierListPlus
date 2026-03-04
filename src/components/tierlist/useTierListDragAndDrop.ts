"use client";

import {
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTierListStore } from "@/hooks/useTierList";
import type { TierConfig } from "@/types";

interface DropTarget {
  isOverContainer: boolean;
  overContainer: string | null;
}

function resolveDropTarget(
  overId: string,
  tierConfig: TierConfig[],
  findContainer: (itemId: string) => string | null,
): DropTarget {
  const isOverContainer = overId === "unranked" || tierConfig.some((tier) => tier.key === overId);
  return {
    isOverContainer,
    overContainer: isOverContainer ? overId : findContainer(overId),
  };
}

function resolveDropIndex(
  overId: string,
  isOverContainer: boolean,
  containerItems: string[],
): number {
  if (isOverContainer) return containerItems.length;
  const overIndex = containerItems.indexOf(overId);
  return overIndex >= 0 ? overIndex : containerItems.length;
}

interface UseTierListDragAndDropArgs {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  findContainer: (itemId: string) => string | null;
  tierConfig: TierConfig[];
}

export function useTierListDragAndDrop({
  activeId,
  setActiveId,
  findContainer,
  tierConfig,
}: UseTierListDragAndDropArgs) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

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
    const suppress = (event: Event) => {
      if (activeIdRef.current) event.stopImmediatePropagation();
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

      const activeItemId = active.id as string;
      const overId = over.id as string;
      const activeContainer = findContainer(activeItemId);
      const { isOverContainer, overContainer } = resolveDropTarget(
        overId,
        tierConfig,
        findContainer,
      );

      if (!activeContainer || !overContainer || activeContainer === overContainer) return;

      // Avoid mutating back into the unranked container while hovering its empty space.
      // On mobile, that path can cause the source/target layouts to oscillate and recurse.
      if (isOverContainer && overContainer === "unranked") return;

      const store = useTierListStore.getState();
      const overItems =
        overContainer === "unranked" ? store.unranked : (store.tiers[overContainer] ?? []);
      const targetIndex = resolveDropIndex(overId, isOverContainer, overItems);
      store.moveItem(activeItemId, overContainer, targetIndex);
    },
    [findContainer, tierConfig],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) return;

      const activeItemId = active.id as string;
      const overId = over.id as string;
      const activeContainer = findContainer(activeItemId);
      const { isOverContainer, overContainer } = resolveDropTarget(
        overId,
        tierConfig,
        findContainer,
      );

      if (!activeContainer || !overContainer) return;

      if (activeContainer !== overContainer) {
        const store = useTierListStore.getState();
        const overItems =
          overContainer === "unranked" ? store.unranked : (store.tiers[overContainer] ?? []);
        const targetIndex = resolveDropIndex(overId, isOverContainer, overItems);
        store.moveItem(activeItemId, overContainer, targetIndex);
        return;
      }

      const store = useTierListStore.getState();
      const containerItems =
        activeContainer === "unranked" ? store.unranked : (store.tiers[activeContainer] ?? []);
      const oldIndex = containerItems.indexOf(activeItemId);

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
    },
    [findContainer, setActiveId, tierConfig],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, [setActiveId]);

  return {
    sensors,
    collisionDetection,
    expandedItemId,
    handleExpandItem,
    handleCollapseExpanded,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
