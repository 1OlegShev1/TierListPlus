"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CloseIcon } from "@/components/ui/icons";

interface DraggableItemProps {
  id: string;
  label: string;
  imageUrl: string;
  overlay?: boolean;
  isExpanded?: boolean;
  onExpand?: (id: string) => void;
  onCollapse?: () => void;
  onRemove?: () => void;
  removing?: boolean;
}

export function DraggableItem({
  id,
  label,
  imageUrl,
  overlay,
  isExpanded = false,
  onExpand,
  onCollapse,
  onRemove,
  removing = false,
}: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: overlay,
  });

  const expanded = !overlay && !isDragging && isExpanded;
  const dndTransform = CSS.Transform.toString(transform);
  const composedTransform = [dndTransform, expanded ? "scale(1.8)" : null]
    .filter(Boolean)
    .join(" ");
  const style = overlay
    ? undefined
    : {
        transform: composedTransform || undefined,
        transition,
        opacity: isDragging ? 0.3 : 1,
        transformOrigin: "center center",
      };

  return (
    <div
      data-peek-item={overlay ? undefined : "true"}
      className={`group relative h-[62px] w-[62px] flex-shrink-0 overflow-visible sm:h-[70px] sm:w-[70px] md:h-[78px] md:w-[78px] lg:h-[96px] lg:w-[96px] ${
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
      <button
        type="button"
        ref={overlay ? undefined : setNodeRef}
        style={style}
        {...(overlay ? {} : attributes)}
        {...(overlay ? {} : listeners)}
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
        className={`relative h-full w-full select-none cursor-grab overflow-hidden rounded-md border bg-transparent p-0 touch-manipulation [-webkit-touch-callout:none] active:cursor-grabbing ${
          overlay
            ? "shadow-xl shadow-black/50 ring-2 ring-amber-400"
            : expanded
              ? "border-amber-300 shadow-2xl shadow-black/60 ring-2 ring-amber-400/70"
              : isDragging
                ? "border-amber-400 ring-2 ring-amber-400/50"
                : "border-neutral-700"
        }`}
      >
        <img src={imageUrl} alt={label} className="h-full w-full object-cover" draggable={false} />
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
