"use client";

import { useDroppable } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { useTierListStore } from "@/hooks/useTierList";
import { cn } from "@/lib/utils";
import type { Item } from "@/types";
import { DraggableItem } from "./DraggableItem";
import {
  COMPACT_UNRANKED_POOL_METRICS_CLASS,
  EDITABLE_UNRANKED_POOL_METRICS_CLASS,
} from "./sizing";

export function UnrankedHeader() {
  const count = useTierListStore((s) => s.unranked.length);
  return (
    <h3 className="text-xs font-medium text-neutral-400 sm:text-sm md:text-base">
      Unranked ({count})
    </h3>
  );
}

interface UnrankedDropZoneProps {
  emptyMessage?: string | null;
  className?: string;
  size?: "compact" | "editable";
  beforeItems?: React.ReactNode;
  afterItems?: React.ReactNode;
  onRemoveItem?: (itemId: string) => void;
  removingItemId?: string | null;
  renderItem?: (item: Item) => React.ReactNode;
}

export function UnrankedDropZone({
  emptyMessage = "All items ranked!",
  className,
  size = "compact",
  beforeItems,
  afterItems,
  onRemoveItem,
  removingItemId,
  renderItem,
}: UnrankedDropZoneProps = {}) {
  const unranked = useTierListStore((s) => s.unranked);
  const itemMap = useTierListStore((s) => s.items);

  const { setNodeRef, isOver } = useDroppable({ id: "unranked" });
  const metricsClassName =
    size === "editable"
      ? EDITABLE_UNRANKED_POOL_METRICS_CLASS
      : COMPACT_UNRANKED_POOL_METRICS_CLASS;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        `flex min-h-[56px] max-h-[calc((var(--unranked-item-height)*2)+var(--unranked-gap)+(var(--unranked-padding)*2))] overflow-y-auto flex-wrap gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-1 transition-colors sm:min-h-[60px] sm:p-1.5 md:min-h-[72px] md:gap-1.5 lg:min-h-[104px] lg:gap-2 lg:p-3 ${metricsClassName} ${
          isOver ? "border-amber-500/50 bg-neutral-800/50" : ""
        }`,
        className,
      )}
    >
      {beforeItems}
      <SortableContext items={unranked} strategy={rectSortingStrategy}>
        {unranked.map((id) => {
          const item = itemMap.get(id);
          if (!item) return null;
          if (renderItem) {
            return renderItem(item);
          }
          return (
            <DraggableItem
              key={id}
              id={id}
              label={item.label}
              imageUrl={item.imageUrl}
              onRemove={onRemoveItem ? () => onRemoveItem(id) : undefined}
              removing={removingItemId === id}
            />
          );
        })}
      </SortableContext>
      {afterItems}
      {unranked.length === 0 && emptyMessage && (
        <span className="flex h-[54px] items-center px-2 text-xs text-neutral-600 sm:h-[58px] sm:px-2.5 md:h-[68px] md:px-3 lg:h-[96px] lg:px-4 lg:text-sm">
          {emptyMessage}
        </span>
      )}
    </div>
  );
}
