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
import { TIER_LABEL_WIDTH_CLASS, TIER_ROW_CONTENT_CLASS, TIER_ROW_HEIGHT_CLASS } from "./tokens";

const EMPTY_TIER_ITEMS: string[] = [];

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
  expandedItemId: string | null;
  onExpandItem: (itemId: string) => void;
  onCollapseExpanded: () => void;
  onOpenItemSource: (itemId: string, readOnly?: boolean) => void;
  canEditItemSource?: boolean;
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
  expandedItemId,
  onExpandItem,
  onCollapseExpanded,
  onOpenItemSource,
  canEditItemSource = false,
}: TierRowProps) {
  const items = useTierListStore((s) => s.tiers[tierKey] ?? EMPTY_TIER_ITEMS);
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
        className={`flex ${TIER_ROW_HEIGHT_CLASS} border-b border-[var(--border-grid)] ${isFirst ? "rounded-t-lg" : ""} ${isLast ? "rounded-b-lg border-b-0" : ""}`}
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
          className={`flex ${TIER_LABEL_WIDTH_CLASS} flex-shrink-0 items-center justify-center`}
          style={{ backgroundColor: color, color: "var(--fg-on-accent)" }}
        >
          {editingLabel ? (
            <input
              ref={inputRef}
              value={localLabel}
              onChange={(e) => setLocalLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter") commitLabel();
                if (e.key === "Escape") {
                  setLocalLabel(label);
                  setEditingLabel(false);
                }
              }}
              maxLength={20}
              className="w-12 rounded bg-[var(--bg-soft-contrast)] px-1 py-0.5 text-center text-[16px] font-bold text-inherit focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)] sm:w-14 md:w-16"
              aria-label="Edit tier label"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                if (canEditTier) setEditingLabel(true);
              }}
              className={`px-1 text-[11px] leading-tight font-bold sm:px-0 sm:text-base md:text-lg lg:text-xl ${canEditTier ? "cursor-text hover:underline" : "cursor-default"}`}
              title={canEditTier ? "Click to edit label" : undefined}
              aria-label={canEditTier ? `Edit ${label} tier label` : `${label} tier`}
            >
              <span className="line-clamp-2 break-words text-center sm:line-clamp-none">
                {label}
              </span>
            </button>
          )}
        </div>

        {/* Items Area */}
        <div
          ref={setNodeRef}
          className={`flex min-w-0 flex-1 flex-wrap items-center content-center transition-colors sm:items-start sm:content-start ${TIER_ROW_CONTENT_CLASS} ${
            isOver ? "bg-[var(--bg-surface-hover)]" : ""
          }`}
        >
          <SortableContext items={items} strategy={rectSortingStrategy}>
            {items.map((id) => {
              const item = itemMap.get(id);
              if (!item) return null;
              return (
                <DraggableItem
                  key={id}
                  id={id}
                  label={item.label}
                  imageUrl={item.imageUrl}
                  sourceUrl={item.sourceUrl}
                  sourceProvider={item.sourceProvider}
                  isExpanded={expandedItemId === id}
                  onExpand={onExpandItem}
                  onCollapse={onCollapseExpanded}
                  onOpenSource={(itemId) => onOpenItemSource(itemId, !canEditItemSource)}
                  canEditSource={canEditItemSource}
                />
              );
            })}
          </SortableContext>
          {items.length === 0 && !isOver && (
            <span className="flex h-[60px] items-center px-2 text-xs text-[var(--fg-subtle)] sm:h-[70px] sm:px-2.5 md:h-[84px] md:px-3 lg:h-[96px] lg:px-4 lg:text-sm">
              Drop items here
            </span>
          )}
        </div>

        {/* Rank button */}
        {items.length >= 2 && (
          <div className="flex flex-shrink-0 items-center border-l border-[var(--border-grid)] px-0.5 sm:px-1.5 md:px-2">
            <button
              type="button"
              onClick={() => setShowBracket(true)}
              className="cursor-pointer rounded px-1 py-0.5 text-[10px] font-medium text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--accent-primary-hover)] sm:px-1.5 sm:py-1 sm:text-xs md:px-2 md:py-1.5 md:text-sm"
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
            className={`flex w-9 flex-shrink-0 flex-col items-center justify-center gap-1 border-l border-[var(--border-grid)] bg-[var(--bg-elevated)] sm:w-11 md:w-12 lg:w-12 ${isFirst ? "rounded-tr-lg" : ""} ${isLast ? "rounded-br-lg" : ""}`}
          >
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isFirst}
              className="cursor-pointer rounded p-1 text-[var(--fg-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--fg-primary)] disabled:cursor-default disabled:opacity-30"
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
              type="button"
              onClick={onMoveDown}
              disabled={isLast}
              className="cursor-pointer rounded p-1 text-[var(--fg-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--fg-primary)] disabled:cursor-default disabled:opacity-30"
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
