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
  metricsClassName?: string;
  expandedScale?: number;
  compareDifferenceState?: "none" | "same" | "changed";
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
  metricsClassName = COMPACT_DRAGGABLE_ITEM_METRICS_CLASS,
  expandedScale = 1.6,
  compareDifferenceState = "none",
}: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: overlay || !enableSorting,
  });

  const expanded = !overlay && !isDragging && isExpanded;
  const dndTransform = CSS.Transform.toString(transform);
  const composedTransform = [dndTransform, expanded ? `scale(${expandedScale})` : null]
    .filter(Boolean)
    .join(" ");
  const shouldToneDownSame =
    compareDifferenceState === "same" && !overlay && !expanded && !isDragging;
  const changedNeutralClass =
    compareDifferenceState === "changed" && !overlay && !expanded && !isDragging
      ? "border-[var(--accent-primary)]/75 ring-1 ring-[var(--focus-ring)] bg-[var(--bg-soft-contrast)]"
      : "border-[var(--border-default)]";
  const style = overlay
    ? undefined
    : {
        transform: composedTransform || undefined,
        transition: enableSorting ? transition : "transform 200ms ease",
        opacity: isDragging ? 0.3 : shouldToneDownSame ? 0.28 : 1,
        filter: shouldToneDownSame ? "grayscale(0.92) saturate(0.22) brightness(0.78)" : undefined,
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
      className={`group relative h-[var(--compact-item-size)] w-[var(--compact-item-size)] flex-shrink-0 overflow-visible ${metricsClassName} ${
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
          className={`absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-overlay)] text-[var(--fg-secondary)] transition-all hover:border-[var(--action-danger-bg)] hover:bg-[var(--action-danger-bg)] hover:text-[var(--action-danger-fg)] ${
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
          className={`absolute left-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-[var(--bg-overlay)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
            sourceUrl
              ? "border-[var(--accent-primary)] text-[var(--accent-primary-hover)] hover:border-[var(--accent-primary-hover)] hover:text-[var(--fg-primary)]"
              : "border-[var(--border-default)] text-[var(--fg-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
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
            ? "shadow-xl ring-2 ring-[var(--accent-primary)]"
            : expanded
              ? "border-[var(--accent-primary-hover)] shadow-2xl ring-2 ring-[var(--focus-ring)]"
              : isDragging
                ? "border-[var(--accent-primary)] ring-2 ring-[var(--focus-ring)]"
                : changedNeutralClass
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
          className={`pointer-events-none absolute inset-x-0 bottom-0 truncate bg-[var(--bg-overlay)] px-1 py-0.5 text-center text-[11px] leading-tight text-[var(--fg-secondary)] transition-opacity ${
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
