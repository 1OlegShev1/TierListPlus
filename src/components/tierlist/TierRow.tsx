"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { DraggableItem } from "./DraggableItem";
import { useTierListStore } from "@/hooks/useTierList";

interface TierRowProps {
  tierKey: string;
  label: string;
  color: string;
}

export function TierRow({ tierKey, label, color }: TierRowProps) {
  const items = useTierListStore((s) => s.tiers[tierKey] ?? []);
  const itemMap = useTierListStore((s) => s.items);

  const { setNodeRef, isOver } = useDroppable({ id: tierKey });

  return (
    <div className="flex min-h-[80px] border-b border-neutral-800">
      {/* Tier Label */}
      <div
        className="flex w-20 flex-shrink-0 items-center justify-center font-bold text-lg"
        style={{ backgroundColor: color, color: "#000" }}
      >
        {label}
      </div>

      {/* Items Area */}
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-wrap items-start gap-1 p-1 transition-colors ${
          isOver ? "bg-neutral-800/50" : ""
        }`}
      >
        <SortableContext items={items} strategy={rectSortingStrategy}>
          {items.map((id) => {
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
        {items.length === 0 && !isOver && (
          <span className="flex h-[72px] items-center px-4 text-sm text-neutral-600">
            Drop items here
          </span>
        )}
      </div>
    </div>
  );
}
