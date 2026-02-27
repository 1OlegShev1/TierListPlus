"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";

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
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: overlay,
  });
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarsePointer(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

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
      {...(overlay || isCoarsePointer ? {} : attributes)}
      {...(overlay || isCoarsePointer ? {} : listeners)}
      className={`group relative h-[62px] w-[62px] select-none flex-shrink-0 overflow-hidden rounded-md border border-neutral-700 sm:h-[70px] sm:w-[70px] md:h-[78px] md:w-[78px] lg:h-[96px] lg:w-[96px] ${
        isCoarsePointer ? "cursor-default" : "cursor-grab active:cursor-grabbing"
      } ${overlay ? "shadow-xl shadow-black/50 ring-2 ring-amber-400" : ""}`}
    >
      <img src={imageUrl} alt={label} className="h-full w-full object-cover" draggable={false} />
      {!overlay && isCoarsePointer && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded bg-black/70 text-[10px] text-neutral-200 active:bg-black/85"
          aria-label={`Drag ${label}`}
          title="Hold and drag"
        >
          ⋮
        </button>
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-center text-[11px] leading-tight text-neutral-200 opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </div>
  );
}
