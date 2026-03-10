"use client";

import { Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ItemSourceModal } from "@/components/items/ItemSourceModal";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import type { ItemSourceProvider } from "@/types";

interface ListDetailGridItem {
  id: string;
  imageUrl: string;
  label: string;
  sourceUrl: string | null;
  sourceProvider: ItemSourceProvider | null;
  sourceNote: string | null;
  sourceStartSec: number | null;
  sourceEndSec: number | null;
}

export function ListDetailItemsGrid({ items }: { items: ListDetailGridItem[] }) {
  const [previewingItemId, setPreviewingItemId] = useState<string | null>(null);
  const [sourceModalItemId, setSourceModalItemId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!previewingItemId) return;
    if (!items.some((item) => item.id === previewingItemId)) {
      setPreviewingItemId(null);
    }
  }, [items, previewingItemId]);

  useEffect(() => {
    if (!sourceModalItemId) return;
    if (!items.some((item) => item.id === sourceModalItemId)) {
      setSourceModalItemId(null);
    }
  }, [items, sourceModalItemId]);

  const sourceModalItem = sourceModalItemId
    ? (items.find((item) => item.id === sourceModalItemId) ?? null)
    : null;

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
          className="relative rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2"
        >
          {item.sourceUrl && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setSourceModalItemId(item.id);
              }}
              className="absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--source-control-linked-border)] bg-[var(--source-control-linked-bg)] text-[var(--source-control-linked-fg)] shadow-sm transition-colors hover:border-[var(--source-control-linked-border-hover)] hover:bg-[var(--source-control-linked-bg-hover)] hover:text-[var(--source-control-linked-fg-hover)]"
              aria-label={`Open source for ${item.label || "item"}`}
            >
              <Link2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setPreviewingItemId((current) => (current === item.id ? null : item.id))}
            onBlur={(event) => {
              const card = cardRefs.current.get(item.id);
              const nextFocused = event.relatedTarget;
              if (card && nextFocused instanceof Node && card.contains(nextFocused)) return;
              setPreviewingItemId((current) => (current === item.id ? null : current));
            }}
            className="block w-full overflow-hidden rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
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
          <p className="mt-1 truncate text-center text-xs text-[var(--fg-secondary)]">
            {item.label}
          </p>
        </div>
      ))}
      {sourceModalItem && (
        <ItemSourceModal
          open
          itemLabel={sourceModalItem.label || "Untitled item"}
          itemImageUrl={sourceModalItem.imageUrl}
          sourceUrl={sourceModalItem.sourceUrl}
          sourceProvider={sourceModalItem.sourceProvider}
          sourceNote={sourceModalItem.sourceNote}
          sourceStartSec={sourceModalItem.sourceStartSec}
          sourceEndSec={sourceModalItem.sourceEndSec}
          editable={false}
          onClose={() => setSourceModalItemId(null)}
        />
      )}
    </div>
  );
}
