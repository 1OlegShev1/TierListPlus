"use client";

import { Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ItemSourceModal } from "@/components/items/source-modal/ItemSourceModal";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { useDoubleTap } from "@/hooks/useDoubleTap";
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
  const [animatedItemId, setAnimatedItemId] = useState<string | null>(null);
  const [sourceFocusedItemId, setSourceFocusedItemId] = useState<string | null>(null);
  const [sourceModalItemId, setSourceModalItemId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (animatedItemId && !items.some((item) => item.id === animatedItemId)) {
      setAnimatedItemId(null);
    }
    if (sourceFocusedItemId && !items.some((item) => item.id === sourceFocusedItemId)) {
      setSourceFocusedItemId(null);
    }
  }, [animatedItemId, items, sourceFocusedItemId]);

  useEffect(() => {
    if (!sourceModalItemId) return;
    if (!items.some((item) => item.id === sourceModalItemId)) {
      setSourceModalItemId(null);
    }
  }, [items, sourceModalItemId]);

  const sourceModalItem = sourceModalItemId
    ? (items.find((item) => item.id === sourceModalItemId) ?? null)
    : null;
  const openExistingItemSource = (item: ListDetailGridItem) => {
    if (!item.sourceUrl) return;
    setSourceModalItemId(item.id);
  };

  const focusItemSource = (item: ListDetailGridItem) => {
    setAnimatedItemId(item.id);
    setSourceFocusedItemId(item.id);
    openExistingItemSource(item);
  };

  const doubleTap = useDoubleTap<string>({
    onDoubleTap: (itemId) => {
      const item = items.find((candidate) => candidate.id === itemId);
      if (item) focusItemSource(item);
    },
    enabled: (itemId) => !!items.find((candidate) => candidate.id === itemId)?.sourceUrl,
  });

  useEffect(() => {
    if (!animatedItemId && !sourceFocusedItemId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const activeAnimatedCard = animatedItemId ? cardRefs.current.get(animatedItemId) : null;
      const activeSourceCard = sourceFocusedItemId
        ? cardRefs.current.get(sourceFocusedItemId)
        : null;
      if (
        event.target instanceof Node &&
        (activeAnimatedCard?.contains(event.target) || activeSourceCard?.contains(event.target))
      ) {
        return;
      }
      setAnimatedItemId(null);
      setSourceFocusedItemId(null);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [animatedItemId, sourceFocusedItemId]);

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
          className={`relative rounded-lg border bg-[var(--bg-surface)] p-2 transition-all ${
            sourceFocusedItemId === item.id
              ? "border-[var(--accent-primary-hover)] shadow-lg ring-2 ring-[var(--focus-ring)]"
              : "border-[var(--border-subtle)]"
          }`}
        >
          {item.sourceUrl && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setAnimatedItemId(item.id);
                setSourceFocusedItemId(item.id);
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
            onClick={(event) => {
              if (doubleTap.shouldIgnoreClick(event)) return;
              setAnimatedItemId((current) => (current === item.id ? null : item.id));
              if (item.sourceUrl) {
                setSourceFocusedItemId((current) => (current === item.id ? null : item.id));
              }
            }}
            onDoubleClick={(event) => {
              if (!item.sourceUrl) return;
              event.preventDefault();
              event.stopPropagation();
              focusItemSource(item);
            }}
            onPointerDown={doubleTap.onPointerDown}
            onPointerUp={(event) => doubleTap.onPointerUp(event, item.id)}
            className="block w-full cursor-pointer overflow-hidden rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
            aria-label={
              item.sourceUrl
                ? `Focus source item ${item.label || "pick"}`
                : item.label || "Template item"
            }
          >
            <ItemArtwork
              src={item.imageUrl}
              alt={item.label}
              className="aspect-square w-full rounded"
              presentation="ambient"
              inset="compact"
              animate={animatedItemId === item.id}
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
