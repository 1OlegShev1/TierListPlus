"use client";

import { useDroppable } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { useTierListStore } from "@/hooks/useTierList";
import { DraggableItem } from "./DraggableItem";

export function UnrankedHeader() {
  const count = useTierListStore((s) => s.unranked.length);
  return <h3 className="text-base font-medium text-neutral-400">Unranked ({count})</h3>;
}

export function UnrankedDropZone() {
  const unranked = useTierListStore((s) => s.unranked);
  const itemMap = useTierListStore((s) => s.items);

  const { setNodeRef, isOver } = useDroppable({ id: "unranked" });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[104px] flex-wrap gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 transition-colors ${
        isOver ? "border-amber-500/50 bg-neutral-800/50" : ""
      }`}
    >
      <SortableContext items={unranked} strategy={rectSortingStrategy}>
        {unranked.map((id) => {
          const item = itemMap.get(id);
          if (!item) return null;
          return <DraggableItem key={id} id={id} label={item.label} imageUrl={item.imageUrl} />;
        })}
      </SortableContext>
      {unranked.length === 0 && (
        <span className="flex h-[96px] items-center px-4 text-sm text-neutral-600">
          All items ranked!
        </span>
      )}
    </div>
  );
}
