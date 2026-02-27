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
        className={`flex min-h-[72px] border-b border-neutral-800 sm:min-h-[80px] md:min-h-[90px] lg:min-h-[104px] ${isFirst ? "rounded-t-lg" : ""} ${isLast ? "rounded-b-lg border-b-0" : ""}`}
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
          className="flex w-16 flex-shrink-0 items-center justify-center sm:w-20 md:w-24 lg:w-28"
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
              className="w-12 rounded bg-black/20 px-1 py-0.5 text-center text-xs font-bold text-inherit focus:outline-none focus:ring-1 focus:ring-black/40 sm:w-14 sm:text-sm md:w-16 md:text-base"
              aria-label="Edit tier label"
            />
          ) : (
            <button
              onClick={() => {
                if (canEditTier) setEditingLabel(true);
              }}
              className={`text-sm font-bold sm:text-base md:text-lg lg:text-xl ${canEditTier ? "cursor-text hover:underline" : "cursor-default"}`}
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
          className={`flex flex-1 flex-wrap items-start gap-1 p-1 transition-colors sm:gap-1.5 sm:p-1.5 md:gap-2 md:p-2 ${
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
            <span className="flex h-[60px] items-center px-2 text-xs text-neutral-600 sm:h-[70px] sm:px-2.5 md:h-[84px] md:px-3 lg:h-[96px] lg:px-4 lg:text-sm">
              Drop items here
            </span>
          )}
        </div>

        {/* Rank button */}
        {items.length >= 2 && (
          <div className="flex flex-shrink-0 items-center border-l border-neutral-800 px-1 sm:px-1.5 md:px-2">
            <button
              onClick={() => setShowBracket(true)}
              className="cursor-pointer rounded px-1 py-0.5 text-[11px] font-medium text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-amber-400 sm:px-1.5 sm:py-1 sm:text-xs md:px-2 md:py-1.5 md:text-sm"
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
            className={`flex w-10 flex-shrink-0 flex-col items-center justify-center gap-1 border-l border-neutral-800 bg-neutral-950/60 sm:w-11 md:w-12 lg:w-12 ${isFirst ? "rounded-tr-lg" : ""} ${isLast ? "rounded-br-lg" : ""}`}
          >
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="cursor-pointer rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:cursor-default disabled:opacity-30"
              title="Move row up"
              aria-label={`Move ${label} tier up`}
            >
              <ChevronUpIcon className="h-4 w-4 sm:h-5 sm:w-5" />
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
              className="cursor-pointer rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:cursor-default disabled:opacity-30"
              title="Move row down"
              aria-label={`Move ${label} tier down`}
            >
              <ChevronDownIcon className="h-4 w-4 sm:h-5 sm:w-5" />
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
