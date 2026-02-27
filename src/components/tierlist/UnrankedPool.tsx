"use client";

import { useDroppable } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { useTierListStore } from "@/hooks/useTierList";
import { DraggableItem } from "./DraggableItem";

export function UnrankedHeader() {
  const count = useTierListStore((s) => s.unranked.length);
  return (
    <h3 className="text-xs font-medium text-neutral-400 sm:text-sm md:text-base">
      Unranked ({count})
    </h3>
  );
}

export function UnrankedDropZone() {
  const unranked = useTierListStore((s) => s.unranked);
  const itemMap = useTierListStore((s) => s.items);

  const { setNodeRef, isOver } = useDroppable({ id: "unranked" });

  return (
    <div
      ref={setNodeRef}
      className={`flex max-h-[24vh] min-h-[56px] overflow-y-auto overscroll-contain flex-wrap gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-1 transition-colors sm:max-h-[26vh] sm:min-h-[60px] sm:p-1.5 md:max-h-[30vh] md:min-h-[72px] md:gap-1.5 lg:max-h-none lg:min-h-[104px] lg:gap-2 lg:p-3 ${
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
        <span className="flex h-[54px] items-center px-2 text-xs text-neutral-600 sm:h-[58px] sm:px-2.5 md:h-[68px] md:px-3 lg:h-[96px] lg:px-4 lg:text-sm">
          All items ranked!
        </span>
      )}
    </div>
  );
}
