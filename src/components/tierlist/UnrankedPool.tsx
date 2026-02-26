"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { DraggableItem } from "./DraggableItem";
import { useTierListStore } from "@/hooks/useTierList";

export function UnrankedPool() {
  const unranked = useTierListStore((s) => s.unranked);
  const itemMap = useTierListStore((s) => s.items);

  const { setNodeRef, isOver } = useDroppable({ id: "unranked" });

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-medium text-neutral-400">
        Unranked ({unranked.length})
      </h3>
      <div
        ref={setNodeRef}
        className={`flex min-h-[80px] flex-wrap gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-2 transition-colors ${
          isOver ? "border-amber-500/50 bg-neutral-800/50" : ""
        }`}
      >
        <SortableContext items={unranked} strategy={rectSortingStrategy}>
          {unranked.map((id) => {
            const item = itemMap.get(id);
            if (!item) return null;
            return (
              <DraggableItem
                key={id}
                id={id}
                label={item.label}
                imageUrl={item.imageUrl}
              />
            );
          })}
        </SortableContext>
        {unranked.length === 0 && (
          <span className="flex h-[72px] items-center px-4 text-sm text-neutral-600">
            All items ranked!
          </span>
        )}
      </div>
    </div>
  );
}
