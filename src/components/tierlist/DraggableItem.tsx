"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface DraggableItemProps {
  id: string;
  label: string;
  imageUrl: string;
  overlay?: boolean;
}

export function DraggableItem({ id, label, imageUrl, overlay }: DraggableItemProps) {
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
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      className={`group relative h-[96px] w-[96px] flex-shrink-0 cursor-grab overflow-hidden rounded-md border border-neutral-700 active:cursor-grabbing ${
        overlay ? "shadow-xl shadow-black/50 ring-2 ring-amber-400" : ""
      }`}
    >
      <img src={imageUrl} alt={label} className="h-full w-full object-cover" draggable={false} />
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-center text-[11px] leading-tight text-neutral-200 opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </div>
  );
}
