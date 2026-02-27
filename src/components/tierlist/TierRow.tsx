"use client";

import { useDroppable } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { useEffect, useRef, useState } from "react";
import { BracketModal } from "@/components/bracket/BracketModal";
import { ChevronDownIcon, ChevronUpIcon } from "@/components/ui/icons";
import { useTierListStore } from "@/hooks/useTierList";
import { DraggableItem } from "./DraggableItem";
import { TierColorPicker } from "./TierColorPicker";
import { TierRowActions } from "./TierRowActions";

interface TierRowProps {
  tierKey: string;
  label: string;
  color: string;
  canEditTier: boolean;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  onLabelChange: (newLabel: string) => void;
  onColorChange: (newColor: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDelete: () => void;
}

export function TierRow({
  tierKey,
  label,
  color,
  canEditTier,
  isFirst,
  isLast,
  canDelete,
  onLabelChange,
  onColorChange,
  onMoveUp,
  onMoveDown,
  onInsertAbove,
  onInsertBelow,
  onDelete,
}: TierRowProps) {
  const items = useTierListStore((s) => s.tiers[tierKey] ?? []);
  const itemMap = useTierListStore((s) => s.items);
  const reorderTier = useTierListStore((s) => s.reorderTier);
  const [showBracket, setShowBracket] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [localLabel, setLocalLabel] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, isOver } = useDroppable({ id: tierKey });

  useEffect(() => {
    setLocalLabel(label);
  }, [label]);

  useEffect(() => {
    if (editingLabel) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingLabel]);

  const commitLabel = () => {
    setEditingLabel(false);
    const trimmed = localLabel.trim();
    if (trimmed && trimmed !== label) {
      onLabelChange(trimmed);
    } else {
      setLocalLabel(label);
    }
  };

  const bracketItems = items
    .map((id) => itemMap.get(id))
    .filter((i): i is { id: string; label: string; imageUrl: string } => !!i);

  return (
    <div>
      <div
        className={`flex min-h-[104px] border-b border-neutral-800 ${isFirst ? "rounded-t-lg" : ""} ${isLast ? "rounded-b-lg border-b-0" : ""}`}
      >
        {/* Color Strip (leftmost) */}
        <TierColorPicker
          color={color}
          label={label}
          canEdit={canEditTier}
          isFirst={isFirst}
          isLast={isLast}
          onColorChange={onColorChange}
        />

        {/* Tier Label */}
        <div
          className="flex w-28 flex-shrink-0 items-center justify-center"
          style={{ backgroundColor: color, color: "#000" }}
        >
          {editingLabel ? (
            <input
              ref={inputRef}
              value={localLabel}
              onChange={(e) => setLocalLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitLabel();
                if (e.key === "Escape") {
                  setLocalLabel(label);
                  setEditingLabel(false);
                }
              }}
              maxLength={20}
              className="w-20 rounded bg-black/20 px-1.5 py-1 text-center text-base font-bold text-inherit focus:outline-none focus:ring-1 focus:ring-black/40"
              aria-label="Edit tier label"
            />
          ) : (
            <button
              onClick={() => {
                if (canEditTier) setEditingLabel(true);
              }}
              className={`text-xl font-bold ${canEditTier ? "cursor-text hover:underline" : "cursor-default"}`}
              title={canEditTier ? "Click to edit label" : undefined}
              aria-label={canEditTier ? `Edit ${label} tier label` : `${label} tier`}
            >
              {label}
            </button>
          )}
        </div>

        {/* Items Area */}
        <div
          ref={setNodeRef}
          className={`flex flex-1 flex-wrap items-start gap-2 p-2 transition-colors ${
            isOver ? "bg-neutral-800/50" : ""
          }`}
        >
          <SortableContext items={items} strategy={rectSortingStrategy}>
            {items.map((id) => {
              const item = itemMap.get(id);
              if (!item) return null;
              return <DraggableItem key={id} id={id} label={item.label} imageUrl={item.imageUrl} />;
            })}
          </SortableContext>
          {items.length === 0 && !isOver && (
            <span className="flex h-[96px] items-center px-4 text-sm text-neutral-600">
              Drop items here
            </span>
          )}
        </div>

        {/* Rank button */}
        {items.length >= 2 && (
          <div className="flex flex-shrink-0 items-center border-l border-neutral-800 px-2">
            <button
              onClick={() => setShowBracket(true)}
              className="cursor-pointer rounded px-2 py-1.5 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-amber-400"
              title="Rank items with 1v1 bracket"
              aria-label={`Rank items in ${label} tier using bracket`}
            >
              Rank
            </button>
          </div>
        )}

        {/* Row edit controls (right side) */}
        {canEditTier && (
          <div
            className={`flex w-12 flex-shrink-0 flex-col items-center justify-center gap-1 border-l border-neutral-800 ${isFirst ? "rounded-tr-lg" : ""} ${isLast ? "rounded-br-lg" : ""}`}
          >
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="cursor-pointer p-1 text-neutral-500 hover:text-neutral-200 disabled:cursor-default disabled:opacity-30"
              title="Move row up"
              aria-label={`Move ${label} tier up`}
            >
              <ChevronUpIcon className="h-4 w-4" />
            </button>

            <TierRowActions
              label={label}
              canDelete={canDelete}
              isLast={isLast}
              onInsertAbove={onInsertAbove}
              onInsertBelow={onInsertBelow}
              onDelete={onDelete}
            />

            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="cursor-pointer p-1 text-neutral-500 hover:text-neutral-200 disabled:cursor-default disabled:opacity-30"
              title="Move row down"
              aria-label={`Move ${label} tier down`}
            >
              <ChevronDownIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {showBracket && (
        <BracketModal
          items={bracketItems}
          onComplete={(rankedIds) => {
            reorderTier(tierKey, rankedIds);
            setShowBracket(false);
          }}
          onCancel={() => setShowBracket(false)}
        />
      )}
    </div>
  );
}
