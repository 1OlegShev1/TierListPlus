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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: overlay });

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
      className={`flex h-[72px] w-[72px] flex-shrink-0 cursor-grab flex-col items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 p-1 active:cursor-grabbing ${
        overlay ? "shadow-xl shadow-black/50 ring-2 ring-amber-400" : ""
      }`}
    >
      <img
        src={imageUrl}
        alt={label}
        className="h-[48px] w-[48px] rounded object-cover"
        draggable={false}
      />
      <span className="w-full truncate text-center text-[10px] leading-tight text-neutral-300">
        {label}
      </span>
    </div>
  );
}
