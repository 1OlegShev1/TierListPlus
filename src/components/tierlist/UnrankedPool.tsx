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
    <h3 className="text-xs font-medium text-[var(--fg-muted)] sm:text-sm md:text-base">
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
  onOpenItemSource?: (itemId: string) => void;
  canEditItemSource?: boolean;
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
  onOpenItemSource,
  canEditItemSource = false,
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
        `flex min-h-[56px] flex-wrap gap-1 rounded-lg border border-[var(--border-grid)] bg-[var(--bg-surface)] p-1 transition-colors sm:min-h-[60px] sm:p-1.5 md:min-h-[72px] md:gap-1.5 lg:min-h-[104px] lg:gap-2 lg:p-3 ${metricsClassName} ${
          isOver ? "border-[var(--accent-primary)]/50 bg-[var(--bg-surface-hover)]" : ""
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
              sourceUrl={item.sourceUrl}
              sourceProvider={item.sourceProvider}
              onOpenSource={onOpenItemSource}
              canEditSource={canEditItemSource}
              onRemove={onRemoveItem ? () => onRemoveItem(id) : undefined}
              removing={removingItemId === id}
            />
          );
        })}
      </SortableContext>
      {afterItems}
      {unranked.length === 0 && emptyMessage && (
        <span className="flex h-[54px] items-center px-2 text-xs text-[var(--fg-subtle)] sm:h-[58px] sm:px-2.5 md:h-[68px] md:px-3 lg:h-[96px] lg:px-4 lg:text-sm">
          {emptyMessage}
        </span>
      )}
    </div>
  );
}
