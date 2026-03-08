"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link2 } from "lucide-react";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { CloseIcon } from "@/components/ui/icons";
import type { ItemSourceProvider } from "@/types";
import { COMPACT_DRAGGABLE_ITEM_METRICS_CLASS } from "./sizing";

interface DraggableItemProps {
  id: string;
  label: string;
  imageUrl: string;
  sourceUrl?: string | null;
  sourceProvider?: ItemSourceProvider | null;
  overlay?: boolean;
  isExpanded?: boolean;
  onExpand?: (id: string) => void;
  onCollapse?: () => void;
  onOpenSource?: (id: string) => void;
  canEditSource?: boolean;
  onRemove?: () => void;
  removing?: boolean;
  enableSorting?: boolean;
  expandedTransformOrigin?: "center center" | "top center" | "bottom center";
}

export function DraggableItem({
  id,
  label,
  imageUrl,
  sourceUrl = null,
  sourceProvider = null,
  overlay,
  isExpanded = false,
  onExpand,
  onCollapse,
  onOpenSource,
  canEditSource = false,
  onRemove,
  removing = false,
  enableSorting = true,
  expandedTransformOrigin = "center center",
}: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: overlay || !enableSorting,
  });

  const expanded = !overlay && !isDragging && isExpanded;
  const dndTransform = CSS.Transform.toString(transform);
  const composedTransform = [dndTransform, expanded ? "scale(1.6)" : null]
    .filter(Boolean)
    .join(" ");
  const style = overlay
    ? undefined
    : {
        transform: composedTransform || undefined,
        transition: enableSorting ? transition : "transform 200ms ease",
        opacity: isDragging ? 0.3 : 1,
        transformOrigin: expanded ? expandedTransformOrigin : "center center",
      };
  const sourceControlVisibilityClass = sourceUrl
    ? "opacity-100"
    : expanded
      ? "opacity-100"
      : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100";

  return (
    <div
      ref={overlay || !enableSorting ? undefined : setNodeRef}
      style={style}
      data-peek-item={overlay ? undefined : "true"}
      className={`group relative h-[var(--compact-item-size)] w-[var(--compact-item-size)] flex-shrink-0 overflow-visible ${COMPACT_DRAGGABLE_ITEM_METRICS_CLASS} ${
        expanded ? "z-20" : "z-0"
      }`}
    >
      {onRemove && !overlay && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-neutral-700 bg-black/70 text-neutral-200 transition-all hover:border-red-500 hover:bg-red-600 hover:text-white ${
            expanded
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          }`}
          aria-label={`Remove ${label || "item"}`}
        >
          {removing ? "..." : <CloseIcon className="h-3.5 w-3.5" />}
        </button>
      )}
      {!overlay && onOpenSource && (canEditSource || !!sourceUrl) && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenSource(id);
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`absolute left-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-black/70 transition-all focus-visible:outline-none focus-visible:ring-2 ${
            sourceUrl
              ? "border-sky-400/80 text-sky-200 hover:border-sky-300 hover:text-sky-100 focus-visible:ring-sky-400/70"
              : "border-amber-500/70 text-amber-300 hover:border-amber-400 hover:text-amber-200 focus-visible:ring-amber-500/60"
          } ${sourceControlVisibilityClass}`}
          aria-label={
            sourceUrl
              ? `Open source for ${label || "item"}`
              : canEditSource
                ? `Add source for ${label || "item"}`
                : `No source for ${label || "item"}`
          }
          title={
            sourceUrl
              ? `${sourceProvider === "SPOTIFY" ? "Spotify" : sourceProvider === "YOUTUBE" ? "YouTube" : "Source"} link`
              : canEditSource
                ? "Add source link"
                : "No source link"
          }
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        {...(overlay || !enableSorting ? {} : attributes)}
        {...(overlay || !enableSorting ? {} : listeners)}
        onClick={
          overlay
            ? undefined
            : (e) => {
                e.preventDefault();
                if (expanded) {
                  onCollapse?.();
                } else {
                  onExpand?.(id);
                }
              }
        }
        onContextMenu={overlay ? undefined : (e) => e.preventDefault()}
        className={`relative h-full w-full select-none overflow-hidden rounded-md border bg-transparent p-0 touch-manipulation [-webkit-touch-callout:none] ${
          enableSorting ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        } ${
          overlay
            ? "shadow-xl shadow-black/50 ring-2 ring-amber-400"
            : expanded
              ? "border-amber-300 shadow-2xl shadow-black/60 ring-2 ring-amber-400/70"
              : isDragging
                ? "border-amber-400 ring-2 ring-amber-400/50"
                : "border-neutral-700"
        }`}
      >
        <ItemArtwork
          src={imageUrl}
          alt={label}
          className="h-full w-full"
          presentation="ambient"
          draggable={false}
          animate={expanded}
          showAnimatedHint
        />
        <span
          className={`pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-center text-[11px] leading-tight text-neutral-200 transition-opacity ${
            expanded
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          }`}
        >
          {label}
        </span>
      </button>
    </div>
  );
}
