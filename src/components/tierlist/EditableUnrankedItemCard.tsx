"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState } from "react";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { CloseIcon } from "@/components/ui/icons";

interface EditableUnrankedItemCardProps {
  id: string;
  label: string;
  imageUrl: string;
  onSaveLabel: (itemId: string, nextLabel: string) => Promise<boolean>;
  onRemove: () => void;
  saving?: boolean;
  removing?: boolean;
}

export function EditableUnrankedItemCard({
  id,
  label,
  imageUrl,
  onSaveLabel,
  onRemove,
  saving = false,
  removing = false,
}: EditableUnrankedItemCardProps) {
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const committingRef = useRef(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: editing,
  });

  useEffect(() => {
    if (!editing) {
      setDraftLabel(label);
    }
  }, [editing, label]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const startEditing = () => {
    if (saving || removing) return;
    setEditing(true);
  };

  const cancelEditing = () => {
    if (saving) return;
    setDraftLabel(label);
    setEditing(false);
  };

  const commitLabel = async () => {
    if (!editing || committingRef.current) return;

    const normalized = draftLabel.trim();
    if (normalized === label) {
      setDraftLabel(label);
      setEditing(false);
      return;
    }

    committingRef.current = true;
    const saved = await onSaveLabel(id, normalized);
    committingRef.current = false;

    if (saved) {
      setEditing(false);
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const style = {
    transform: CSS.Transform.toString(transform) || undefined,
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const labelText = label.trim().length > 0 ? label : "Tap to name";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative w-[112px] flex-shrink-0 rounded-lg border border-neutral-700 bg-neutral-950 p-1.5 sm:w-[120px] md:w-[128px]"
    >
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
        disabled={saving || removing}
        className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-neutral-700 bg-black/70 text-neutral-200 transition-all hover:border-red-500 hover:bg-red-600 hover:text-white disabled:cursor-default disabled:opacity-70"
        aria-label={`Remove ${label || "item"}`}
      >
        {removing ? "..." : <CloseIcon className="h-3.5 w-3.5" />}
      </button>

      {editing ? (
        <div className="aspect-square w-full overflow-hidden rounded">
          <ItemArtwork
            src={imageUrl}
            alt={label || "Editable item"}
            className="h-full w-full"
            presentation="ambient"
            inset="compact"
          />
        </div>
      ) : (
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={startEditing}
          className="block aspect-square w-full cursor-grab overflow-hidden rounded active:cursor-grabbing"
          aria-label={`Edit ${label || "item"} label or drag to rank`}
        >
          <ItemArtwork
            src={imageUrl}
            alt={label || "Editable item"}
            className="h-full w-full"
            presentation="ambient"
            inset="compact"
            draggable={false}
          />
        </button>
      )}

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onBlur={() => {
            void commitLabel();
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") {
              e.preventDefault();
              void commitLabel();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancelEditing();
            }
          }}
          maxLength={100}
          disabled={saving}
          placeholder="Name this pick"
          className="mt-1 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-white placeholder:text-neutral-500 focus:border-amber-500 focus:outline-none disabled:opacity-70"
          aria-label="Edit item label"
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          disabled={saving || removing}
          className="mt-1 block w-full truncate rounded border border-transparent px-1 py-1 text-left text-xs text-neutral-200 transition-colors hover:border-neutral-800 hover:bg-neutral-900 disabled:cursor-default disabled:opacity-70"
          title={labelText}
          aria-label={`Edit ${label || "item"} label`}
        >
          {labelText}
        </button>
      )}
    </div>
  );
}
