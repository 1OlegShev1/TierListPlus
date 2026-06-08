"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { CloseIcon } from "@/components/ui/icons";
import { useDoubleTap } from "@/hooks/useDoubleTap";
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
  interactionMode?: "spotlight" | "sourceFocus";
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
  interactionMode = "spotlight",
}: DraggableItemProps) {
  const staticId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [sourceFocused, setSourceFocused] = useState(false);
  const sortableId = overlay || !enableSorting ? `static-${staticId}` : id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    disabled: overlay || !enableSorting,
  });

  const canOpenSource = !!onOpenSource && (canEditSource || !!sourceUrl);
  const usesSourceFocus = interactionMode === "sourceFocus";
  const expanded = !usesSourceFocus && !overlay && !isDragging && isExpanded;
  const sourceFocusActive = usesSourceFocus && !overlay && !isDragging && sourceFocused;
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
  const openSource = () => {
    if (!canOpenSource || overlay) return;
    onOpenSource(id);
  };
  const doubleTap = useDoubleTap<string>({
    onDoubleTap: () => {
      setSourceFocused(true);
      openSource();
    },
    enabled: () => canOpenSource && !overlay,
  });

  useEffect(() => {
    if (canOpenSource) return;
    setSourceFocused(false);
  }, [canOpenSource]);

  useEffect(() => {
    if (!sourceFocused) return;

    const clearSourceFocus = (event: PointerEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        rootRef.current.contains(event.target)
      ) {
        return;
      }
      setSourceFocused(false);
    };

    document.addEventListener("pointerdown", clearSourceFocus, true);
    return () => document.removeEventListener("pointerdown", clearSourceFocus, true);
  }, [sourceFocused]);

  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        if (!overlay && enableSorting) setNodeRef(node);
      }}
      style={style}
      data-peek-item={overlay ? undefined : "true"}
      data-draggable-item={overlay ? undefined : "true"}
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
          className={`absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-media-overlay)] text-[var(--fg-on-media-overlay)] transition-all hover:border-[var(--action-danger-bg)] hover:bg-[var(--action-danger-bg)] hover:text-[var(--action-danger-fg)] ${
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
          className={`absolute left-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
            sourceUrl
              ? "border-[var(--source-control-linked-border)] bg-[var(--source-control-linked-bg)] text-[var(--source-control-linked-fg)] hover:border-[var(--source-control-linked-border-hover)] hover:bg-[var(--source-control-linked-bg-hover)] hover:text-[var(--source-control-linked-fg-hover)]"
              : "border-[var(--source-control-unlinked-border)] bg-[var(--source-control-unlinked-bg)] text-[var(--source-control-unlinked-fg)] hover:border-[var(--source-control-unlinked-border-hover)] hover:bg-[var(--source-control-unlinked-bg-hover)] hover:text-[var(--source-control-unlinked-fg-hover)]"
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
          <Link2 className="h-4 w-4" aria-hidden="true" />
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
                if (doubleTap.shouldIgnoreClick(e)) return;
                if (usesSourceFocus) {
                  setSourceFocused((current) => !current);
                  return;
                }
                if (expanded) {
                  onCollapse?.();
                } else {
                  onExpand?.(id);
                }
              }
        }
        onDoubleClick={
          overlay
            ? undefined
            : (event) => {
                if (!canOpenSource) return;
                event.preventDefault();
                event.stopPropagation();
                setSourceFocused(true);
                openSource();
              }
        }
        onPointerDown={
          overlay
            ? undefined
            : (e) => {
                doubleTap.onPointerDown();
                if (enableSorting) listeners?.onPointerDown?.(e);
              }
        }
        onPointerUp={overlay ? undefined : (e) => doubleTap.onPointerUp(e, id)}
        onDragStart={(event) => event.preventDefault()}
        onContextMenu={overlay ? undefined : (e) => e.preventDefault()}
        className={`draggable-handle relative h-full w-full select-none overflow-hidden rounded-md border bg-transparent p-0 [-webkit-touch-callout:none] ${
          enableSorting ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        } ${
          overlay
            ? "shadow-xl ring-2 ring-[var(--accent-primary)]"
            : expanded || sourceFocusActive
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
          animate={expanded || sourceFocusActive}
          showAnimatedHint
        />
        <span
          className={`pointer-events-none absolute inset-x-0 bottom-0 truncate bg-[var(--bg-media-overlay)] px-1 py-0.5 text-center text-[11px] leading-tight text-[var(--fg-on-media-overlay)] transition-opacity ${
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
