"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ItemSourceModal } from "@/components/items/source-modal/ItemSourceModal";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { CloseIcon } from "@/components/ui/icons";
import type { ItemSourceProvider } from "@/types";
import { EDITABLE_UNRANKED_ITEM_METRICS_CLASS } from "./sizing";

interface EditableUnrankedItemCardProps {
  id: string;
  label: string;
  imageUrl: string;
  sourceUrl?: string | null;
  sourceProvider?: ItemSourceProvider | null;
  sourceNote?: string | null;
  sourceStartSec?: number | null;
  sourceEndSec?: number | null;
  onSaveLabel: (itemId: string, nextLabel: string) => Promise<boolean>;
  onSaveSource: (
    itemId: string,
    next: {
      sourceUrl: string | null;
      sourceNote: string | null;
      sourceStartSec: number | null;
      sourceEndSec: number | null;
      itemLabel?: string | null;
      resolvedImageUrl?: string | null;
    },
  ) => Promise<boolean>;
  onRemove: () => void;
  saving?: boolean;
  removing?: boolean;
  sourceError?: string | null;
}

export function EditableUnrankedItemCard({
  id,
  label,
  imageUrl,
  sourceUrl = null,
  sourceProvider = null,
  sourceNote = null,
  sourceStartSec = null,
  sourceEndSec = null,
  onSaveLabel,
  onSaveSource,
  onRemove,
  saving = false,
  removing = false,
  sourceError = null,
}: EditableUnrankedItemCardProps) {
  const [editing, setEditing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const committingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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
    setPreviewing(false);
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

  useEffect(() => {
    if (!previewing) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        rootRef.current.contains(event.target)
      ) {
        return;
      }
      setPreviewing(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [previewing]);

  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        setNodeRef(node);
      }}
      style={style}
      className={`group relative flex h-[var(--editable-item-height)] w-[var(--editable-item-width)] flex-shrink-0 flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-[var(--editable-item-padding)] ${EDITABLE_UNRANKED_ITEM_METRICS_CLASS}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSourceOpen(true);
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        disabled={saving || removing}
        className={`absolute left-1.5 top-1.5 z-10 flex h-6 min-w-6 items-center justify-center gap-1 rounded-full border px-1.5 text-[10px] font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-default disabled:opacity-70 ${
          sourceUrl
            ? "border-[var(--source-control-linked-border)] bg-[var(--source-control-linked-bg)] text-[var(--source-control-linked-fg)] hover:border-[var(--source-control-linked-border-hover)] hover:bg-[var(--source-control-linked-bg-hover)] hover:text-[var(--source-control-linked-fg-hover)]"
            : "border-[var(--source-control-unlinked-border)] bg-[var(--source-control-unlinked-bg)] text-[var(--source-control-unlinked-fg)] hover:border-[var(--source-control-unlinked-border-hover)] hover:bg-[var(--source-control-unlinked-bg-hover)] hover:text-[var(--source-control-unlinked-fg-hover)]"
        }`}
        aria-label={
          sourceUrl ? `Open source for ${label || "item"}` : `Add source for ${label || "item"}`
        }
        title={sourceUrl ? "Open source link" : "Add source link"}
      >
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        {sourceUrl ? "See" : "Add"}
      </button>

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
        className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-media-overlay)] text-[var(--fg-on-media-overlay)] transition-all hover:border-[var(--action-danger-bg)] hover:bg-[var(--action-danger-bg)] hover:text-[var(--action-danger-fg)] disabled:cursor-default disabled:opacity-70"
        aria-label={`Remove ${label || "item"}`}
      >
        {removing ? "..." : <CloseIcon className="h-3.5 w-3.5" />}
      </button>

      {editing ? (
        <div className="h-[var(--editable-item-media-size)] w-full overflow-hidden rounded">
          <ItemArtwork
            src={imageUrl}
            alt={label || "Editable item"}
            className="h-full w-full"
            presentation="ambient"
            inset="compact"
            draggable={false}
            showAnimatedHint
          />
        </div>
      ) : (
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={() => setPreviewing((current) => !current)}
          onContextMenu={(event) => event.preventDefault()}
          onDragStart={(event) => event.preventDefault()}
          onBlur={(event) => {
            const nextFocused = event.relatedTarget;
            if (
              rootRef.current &&
              nextFocused instanceof Node &&
              rootRef.current.contains(nextFocused)
            ) {
              return;
            }
            setPreviewing(false);
          }}
          className="draggable-handle block h-[var(--editable-item-media-size)] w-full cursor-grab overflow-hidden rounded active:cursor-grabbing [-webkit-touch-callout:none]"
          aria-label={`Preview animation for ${label || "item"} or drag to rank`}
        >
          <ItemArtwork
            src={imageUrl}
            alt={label || "Editable item"}
            className="h-full w-full"
            presentation="ambient"
            inset="compact"
            draggable={false}
            animate={previewing}
            showAnimatedHint
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
          className="mt-[var(--editable-item-label-gap)] h-[var(--editable-item-label-height)] w-full rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--fg-primary)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent-primary)] focus:outline-none disabled:opacity-70"
          aria-label="Edit item label"
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          disabled={saving || removing}
          className="mt-[var(--editable-item-label-gap)] block h-[var(--editable-item-label-height)] w-full truncate rounded border border-transparent px-1 py-1 text-left text-xs text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] disabled:cursor-default disabled:opacity-70"
          title={labelText}
          aria-label={`Edit ${label || "item"} label`}
        >
          {labelText}
        </button>
      )}

      {sourceOpen && (
        <ItemSourceModal
          open
          itemLabel={label || "Untitled item"}
          itemImageUrl={imageUrl}
          sourceUrl={sourceUrl}
          sourceProvider={sourceProvider}
          sourceNote={sourceNote}
          sourceStartSec={sourceStartSec}
          sourceEndSec={sourceEndSec}
          editable
          saving={saving}
          error={sourceError}
          onClose={() => setSourceOpen(false)}
          onSave={(next) => onSaveSource(id, next)}
        />
      )}
    </div>
  );
}
