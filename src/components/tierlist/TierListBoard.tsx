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
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useTierListStore } from "@/hooks/useTierList";
import { apiPost, getErrorMessage } from "@/lib/api-client";
import type { Item, TierConfig } from "@/types";
import { DraggableItem } from "./DraggableItem";
import { TierRow } from "./TierRow";
import { UnrankedPool } from "./UnrankedPool";

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
  tierConfig,
  sessionItems,
  seededTiers,
  onSubmitted,
}: TierListBoardProps) {
  const { initialize, setActiveId, activeId, items, findContainer, tiers, getVotes } =
    useTierListStore();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    initialize(
      sessionItems,
      tierConfig.map((t) => t.key),
      seededTiers,
    );
  }, [sessionItems, tierConfig, seededTiers, initialize]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Custom collision detection: prefer pointerWithin for containers, closestCenter for items
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // First check if pointer is within a droppable
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    // Fall back to rect intersection
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
      // Check if overId is a container (tier key or "unranked")
      const isOverContainer = overId === "unranked" || tierConfig.some((t) => t.key === overId);
      const overContainer = isOverContainer ? overId : findContainer(overId);

      if (!activeContainer || !overContainer || activeContainer === overContainer) {
        return;
      }

      // Move between containers on drag over for responsive feel
      const store = useTierListStore.getState();
      const overItems =
        overContainer === "unranked" ? store.unranked : (store.tiers[overContainer] ?? []);

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
        // Reorder within the same container
        const store = useTierListStore.getState();
        const containerItems =
          activeContainer === "unranked" ? store.unranked : (store.tiers[activeContainer] ?? []);

        const oldIndex = containerItems.indexOf(activeId);
        const newIndex = containerItems.indexOf(overId);

        if (oldIndex !== newIndex && oldIndex >= 0 && newIndex >= 0) {
          store.reorderInContainer(activeContainer, oldIndex, newIndex);
        }
      }
      // Cross-container moves are already handled in handleDragOver
    },
    [findContainer, setActiveId, tierConfig],
  );

  const handleSubmit = async () => {
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
            <TierRow key={tier.key} tierKey={tier.key} label={tier.label} color={tier.color} />
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
        <Button onClick={handleSubmit} disabled={submitting || rankedCount === 0}>
          {submitting ? "Submitting..." : "Submit Votes"}
        </Button>
        <span className="text-sm text-neutral-500">
          {rankedCount}/{totalItems} items ranked
        </span>
      </div>
      {submitError && <p className="mt-2 text-sm text-red-400">{submitError}</p>}
    </div>
  );
}
