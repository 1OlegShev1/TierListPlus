"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { DraggableItem } from "./DraggableItem";
import { BracketModal } from "@/components/bracket/BracketModal";
import { useTierListStore } from "@/hooks/useTierList";

interface TierRowProps {
  tierKey: string;
  label: string;
  color: string;
}

export function TierRow({ tierKey, label, color }: TierRowProps) {
  const items = useTierListStore((s) => s.tiers[tierKey] ?? []);
  const itemMap = useTierListStore((s) => s.items);
  const reorderTier = useTierListStore((s) => s.reorderTier);
  const [showBracket, setShowBracket] = useState(false);

  const { setNodeRef, isOver } = useDroppable({ id: tierKey });

  const bracketItems = items
    .map((id) => itemMap.get(id))
    .filter((i): i is { id: string; label: string; imageUrl: string } => !!i);

  return (
    <>
      <div className="flex min-h-[80px] border-b border-neutral-800">
        {/* Tier Label */}
        <div
          className="flex w-20 flex-shrink-0 flex-col items-center justify-center gap-1"
          style={{ backgroundColor: color, color: "#000" }}
        >
          <span className="text-lg font-bold">{label}</span>
          {items.length >= 2 && (
            <button
              onClick={() => setShowBracket(true)}
              className="rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-black/40"
              title="Rank items with 1v1 bracket"
            >
              Rank
            </button>
          )}
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

      {showBracket && (
        <BracketModal
          items={bracketItems}
          onComplete={(rankedIds) => {
            reorderTier(tierKey, rankedIds);
            setShowBracket(false);
          }}
          onCancel={() => setShowBracket(false)}
        />
      )}
    </>
  );
}
