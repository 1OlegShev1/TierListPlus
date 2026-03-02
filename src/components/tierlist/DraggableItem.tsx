"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface DraggableItemProps {
  id: string;
  label: string;
  imageUrl: string;
  overlay?: boolean;
  onRemove?: () => void;
  removing?: boolean;
}

export function DraggableItem({
  id,
  label,
  imageUrl,
  overlay,
  onRemove,
  removing = false,
}: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: overlay,
  });

  const style = overlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      };

  return (
    <div className="group relative h-[62px] w-[62px] flex-shrink-0 sm:h-[70px] sm:w-[70px] md:h-[78px] md:w-[78px] lg:h-[96px] lg:w-[96px]">
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
          className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={`Remove ${label || "item"}`}
        >
          {removing ? "..." : "x"}
        </button>
      )}
      <button
        type="button"
        ref={overlay ? undefined : setNodeRef}
        style={style}
        {...(overlay ? {} : attributes)}
        {...(overlay ? {} : listeners)}
        onContextMenu={overlay ? undefined : (e) => e.preventDefault()}
        className={`relative h-full w-full select-none cursor-grab overflow-hidden rounded-md border bg-transparent p-0 touch-manipulation [-webkit-touch-callout:none] active:cursor-grabbing ${
          overlay
            ? "shadow-xl shadow-black/50 ring-2 ring-amber-400"
            : isDragging
              ? "border-amber-400 ring-2 ring-amber-400/50"
              : "border-neutral-700"
        }`}
      >
        <img src={imageUrl} alt={label} className="h-full w-full object-cover" draggable={false} />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-center text-[11px] leading-tight text-neutral-200 opacity-0 transition-opacity group-hover:opacity-100">
          {label}
        </span>
      </button>
    </div>
  );
}
