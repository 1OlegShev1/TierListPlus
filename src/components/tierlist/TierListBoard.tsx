"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type CollisionDetection,
  rectIntersection,
  getFirstCollision,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { TierRow } from "./TierRow";
import { UnrankedPool } from "./UnrankedPool";
import { DraggableItem } from "./DraggableItem";
import { useTierListStore } from "@/hooks/useTierList";
import type { TierConfig } from "@/lib/constants";

interface SessionItem {
  id: string;
  label: string;
  imageUrl: string;
}

interface TierListBoardProps {
  sessionId: string;
  participantId: string;
  tierConfig: TierConfig[];
  sessionItems: SessionItem[];
  onSubmitted: () => void;
}

export function TierListBoard({
  sessionId,
  participantId,
  tierConfig,
  sessionItems,
  onSubmitted,
}: TierListBoardProps) {
  const { initialize, setActiveId, activeId, items, findContainer, tiers, unranked, getVotes } =
    useTierListStore();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    initialize(
      sessionItems,
      tierConfig.map((t) => t.key)
    );
  }, [sessionItems, tierConfig, initialize]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Custom collision detection: prefer pointerWithin for containers, closestCenter for items
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      // First check if pointer is within a droppable
      const pointerCollisions = pointerWithin(args);
      if (pointerCollisions.length > 0) {
        return pointerCollisions;
      }
      // Fall back to rect intersection
      return rectIntersection(args);
    },
    []
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
    },
    [setActiveId]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeContainer = findContainer(activeId);
      // Check if overId is a container (tier key or "unranked")
      const isOverContainer =
        overId === "unranked" || tierConfig.some((t) => t.key === overId);
      const overContainer = isOverContainer
        ? overId
        : findContainer(overId);

      if (!activeContainer || !overContainer || activeContainer === overContainer) {
        return;
      }

      // Move between containers on drag over for responsive feel
      const store = useTierListStore.getState();
      const overItems =
        overContainer === "unranked"
          ? store.unranked
          : store.tiers[overContainer] ?? [];

      let newIndex: number;
      if (isOverContainer) {
        // Dropped on empty container
        newIndex = overItems.length;
      } else {
        const overIndex = overItems.indexOf(overId);
        newIndex = overIndex >= 0 ? overIndex : overItems.length;
      }

      store.moveItem(activeId, overContainer, newIndex);
    },
    [findContainer, tierConfig]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeContainer = findContainer(activeId);
      const isOverContainer =
        overId === "unranked" || tierConfig.some((t) => t.key === overId);
      const overContainer = isOverContainer
        ? overId
        : findContainer(overId);

      if (!activeContainer || !overContainer) return;

      if (activeContainer === overContainer) {
        // Reorder within the same container
        const store = useTierListStore.getState();
        const containerItems =
          activeContainer === "unranked"
            ? store.unranked
            : store.tiers[activeContainer] ?? [];

        const oldIndex = containerItems.indexOf(activeId);
        const newIndex = containerItems.indexOf(overId);

        if (oldIndex !== newIndex && oldIndex >= 0 && newIndex >= 0) {
          store.reorderInContainer(activeContainer, oldIndex, newIndex);
        }
      }
      // Cross-container moves are already handled in handleDragOver
    },
    [findContainer, setActiveId, tierConfig]
  );

  const handleSubmit = async () => {
    const votes = getVotes();
    if (votes.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, votes }),
      });
      if (res.ok) {
        onSubmitted();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const activeItem = activeId ? items.get(activeId) : null;
  const totalItems = sessionItems.length;
  const rankedCount = Object.values(tiers).reduce((sum, ids) => sum + ids.length, 0);

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Tier Rows */}
        <div className="overflow-hidden rounded-lg border border-neutral-800">
          {tierConfig.map((tier) => (
            <TierRow
              key={tier.key}
              tierKey={tier.key}
              label={tier.label}
              color={tier.color}
            />
          ))}
        </div>

        {/* Unranked Pool */}
        <UnrankedPool />

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

      {/* Submit */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleSubmit}
          disabled={submitting || rankedCount === 0}
          className="rounded-lg bg-amber-500 px-6 py-2 font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Votes"}
        </button>
        <span className="text-sm text-neutral-500">
          {rankedCount}/{totalItems} items ranked
        </span>
      </div>
    </div>
  );
}
