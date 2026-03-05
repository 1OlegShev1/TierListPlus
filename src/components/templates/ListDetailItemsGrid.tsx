"use client";

import { useEffect, useRef, useState } from "react";
import { ItemArtwork } from "@/components/ui/ItemArtwork";

interface ListDetailGridItem {
  id: string;
  imageUrl: string;
  label: string;
}

export function ListDetailItemsGrid({ items }: { items: ListDetailGridItem[] }) {
  const [previewingItemId, setPreviewingItemId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!previewingItemId) return;
    if (!items.some((item) => item.id === previewingItemId)) {
      setPreviewingItemId(null);
    }
  }, [items, previewingItemId]);

  useEffect(() => {
    if (!previewingItemId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const activeCard = cardRefs.current.get(previewingItemId);
      if (!activeCard) {
        setPreviewingItemId(null);
        return;
      }
      if (event.target instanceof Node && activeCard.contains(event.target)) return;
      setPreviewingItemId(null);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [previewingItemId]);

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {items.map((item) => (
        <div
          key={item.id}
          ref={(node) => {
            if (!node) {
              cardRefs.current.delete(item.id);
              return;
            }
            cardRefs.current.set(item.id, node);
          }}
          className="rounded-lg border border-neutral-800 bg-neutral-900 p-2"
        >
          <button
            type="button"
            onClick={() => setPreviewingItemId((current) => (current === item.id ? null : item.id))}
            onBlur={(event) => {
              const card = cardRefs.current.get(item.id);
              const nextFocused = event.relatedTarget;
              if (card && nextFocused instanceof Node && card.contains(nextFocused)) return;
              setPreviewingItemId((current) => (current === item.id ? null : current));
            }}
            className="block w-full overflow-hidden rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
            aria-label={`Preview animation for ${item.label || "pick"}`}
          >
            <ItemArtwork
              src={item.imageUrl}
              alt={item.label}
              className="aspect-square w-full rounded"
              presentation="ambient"
              inset="compact"
              animate={previewingItemId === item.id}
              showAnimatedHint
            />
          </button>
          <p className="mt-1 truncate text-center text-xs text-neutral-300">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
