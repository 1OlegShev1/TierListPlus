"use client";

import { DndContext, DragOverlay } from "@dnd-kit/core";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ItemSourceModal } from "@/components/items/source-modal/ItemSourceModal";
import { CombinedAddItemTile } from "@/components/shared/CombinedAddItemTile";
import { ThemedTooltip } from "@/components/ui/ThemedTooltip";
import { useDelayedBusy } from "@/hooks/useDelayedBusy";
import { useTierListStore } from "@/hooks/useTierList";
import { useUser } from "@/hooks/useUser";
import { apiPost, getErrorMessage } from "@/lib/api-client";
import { seedTiersFromRanking } from "@/lib/bracket-seeding";
import {
  normalizeItemLabel,
  parseAnyItemSource,
  resolveItemImageUrlForWrite,
  suggestItemLabelFromSourceUrl,
} from "@/lib/item-source";
import { createVoteBoardDraftSnapshot } from "@/lib/vote-draft-storage";
import type { Item, TierConfig } from "@/types";
import { DraggableItem } from "./DraggableItem";
import { EditableUnrankedItemCard } from "./EditableUnrankedItemCard";
import { EditableUnrankedItemOverlay } from "./EditableUnrankedItemOverlay";
import { TierRow } from "./TierRow";
import { UnrankedDropZone, UnrankedHeader } from "./UnrankedPool";
import { useLiveSessionItems } from "./useLiveSessionItems";
import { useTierConfigEditor } from "./useTierConfigEditor";
import { useTierListDragAndDrop } from "./useTierListDragAndDrop";
import { useVoteBoardDrafts } from "./useVoteBoardDrafts";

const BracketModal = dynamic(
  () => import("../bracket/BracketModal").then((mod) => mod.BracketModal),
  { ssr: false },
);

interface TierListBoardProps {
  sessionId: string;
  participantId: string;
  tierConfig: TierConfig[];
  sessionItems: Item[];
  seededTiers?: Record<string, string[]>;
  canEditTierConfig?: boolean;
  canSaveTemplate?: boolean;
  canManageItems?: boolean;
  templateIsHidden?: boolean;
  onSubmitted: () => void;
  onNotice?: (notice: {
    tone: "amber" | "emerald";
    message: string;
    actionHref?: string;
    actionLabel?: string;
    durationMs?: number;
  }) => void;
}

export function TierListBoard({
  sessionId,
  participantId,
  tierConfig: initialTierConfig,
  sessionItems,
  seededTiers,
  canEditTierConfig = false,
  canSaveTemplate = false,
  canManageItems = false,
  templateIsHidden = false,
  onSubmitted,
  onNotice,
}: TierListBoardProps) {
  const { userId, isLoading: userLoading, error: userError } = useUser();
  const {
    initialize,
    setActiveId,
    activeId,
    items,
    findContainer,
    tiers,
    unranked,
    getVotes,
    addTier: addTierToStore,
    removeTier: removeTierFromStore,
    appendItem,
    updateItem,
    removeItem,
  } = useTierListStore();

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSessionBracket, setShowSessionBracket] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveTemplateError, setSaveTemplateError] = useState<string | null>(null);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [sourceModalItemId, setSourceModalItemId] = useState<string | null>(null);
  const [sourceModalReadOnly, setSourceModalReadOnly] = useState(false);
  const [boardInitialized, setBoardInitialized] = useState(false);
  const [showAddByUrlSourceModal, setShowAddByUrlSourceModal] = useState(false);
  const [addByUrlSourceError, setAddByUrlSourceError] = useState<string | null>(null);
  const showSubmitBusyState = useDelayedBusy(submitting, {
    showDelayMs: 180,
    minVisibleMs: 320,
  });
  const showSaveTemplateBusyState = useDelayedBusy(savingTemplate, {
    showDelayMs: 180,
    minVisibleMs: 320,
  });
  const submitActionLocked = submitting || showSubmitBusyState;
  const saveTemplateActionLocked = savingTemplate || showSaveTemplateBusyState;

  const {
    tierConfig,
    containerRef,
    handleLabelChange,
    handleColorChange,
    handleMoveTier,
    handleInsertTier,
    handleDeleteTier,
    flushPendingTierConfigSave,
  } = useTierConfigEditor({
    initialTierConfig,
    canEditTierConfig,
    sessionId,
    addTierToStore,
    removeTierFromStore,
  });

  const {
    creatingItemCount,
    savingItemId,
    removingItemId,
    itemMutationError,
    setItemMutationError,
    hasActiveUpload,
    hasPendingItemMutations,
    handleUploadStateChange,
    handleUploadedImage,
    handleAddItemFromUrl,
    handleSaveLiveItemLabel,
    handleSaveLiveItemSource,
    handleRemoveLiveItem,
  } = useLiveSessionItems({
    sessionId,
    canManageItems,
    submitting,
    submitted,
    appendItem,
    updateItem,
    removeItem,
  });
  const showCreatingItemState = useDelayedBusy(creatingItemCount > 0, {
    showDelayMs: 180,
    minVisibleMs: 320,
  });

  const tierKeys = useMemo(() => initialTierConfig.map((tier) => tier.key), [initialTierConfig]);
  const baselineValidItemIds = useMemo(
    () => new Set(sessionItems.map((item) => item.id)),
    [sessionItems],
  );
  const liveItems = useMemo(
    () => (boardInitialized ? Array.from(items.values()) : sessionItems),
    [boardInitialized, items, sessionItems],
  );
  const currentValidItemIds = useMemo(() => new Set(liveItems.map((item) => item.id)), [liveItems]);

  const baselineSnapshot = useMemo(() => {
    const seen = new Set<string>();
    const baselineTiers: Record<string, string[]> = {};

    for (const tierKey of tierKeys) {
      const seededIds = seededTiers?.[tierKey] ?? [];
      const tierItems: string[] = [];
      for (const id of seededIds) {
        if (!baselineValidItemIds.has(id) || seen.has(id)) continue;
        seen.add(id);
        tierItems.push(id);
      }
      baselineTiers[tierKey] = tierItems;
    }

    const baselineUnranked: string[] = [];
    for (const item of sessionItems) {
      if (!seen.has(item.id)) {
        baselineUnranked.push(item.id);
      }
    }

    return createVoteBoardDraftSnapshot({
      updatedAtMs: 1,
      tierKeys,
      validItemIds: baselineValidItemIds,
      tiers: baselineTiers,
      unranked: baselineUnranked,
    });
  }, [baselineValidItemIds, tierKeys, seededTiers, sessionItems]);

  const currentSnapshot = useMemo(
    () =>
      createVoteBoardDraftSnapshot({
        updatedAtMs: 1,
        tierKeys,
        validItemIds: currentValidItemIds,
        tiers,
        unranked,
      }),
    [currentValidItemIds, tierKeys, tiers, unranked],
  );

  // Initialize Zustand store only once on mount.
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    initialize(sessionItems, tierKeys, seededTiers, null);
    setBoardInitialized(true);
  }, [initialize, seededTiers, sessionItems, tierKeys]);

  const { clearStoredDraft } = useVoteBoardDrafts({
    userId,
    userLoading,
    sessionId,
    participantId,
    tierKeys,
    validItemIds: currentValidItemIds,
    enabled: boardInitialized,
    baselineSnapshot,
    currentSnapshot,
    warnOnUnloadWhenDirty: boardInitialized && !submitting && !submitted,
    onApplySnapshot: (snapshot) => {
      initialize(sessionItems, tierKeys, seededTiers, {
        tiers: snapshot.tiers,
        unranked: snapshot.unranked,
      });
    },
    onDraftRestored: () =>
      onNotice?.({
        tone: "amber",
        message: "Draft restored.",
        durationMs: 3000,
      }),
  });

  const rankedCount = Object.values(tiers).reduce((sum, ids) => sum + ids.length, 0);

  const {
    sensors,
    collisionDetection,
    expandedItemId,
    handleExpandItem,
    handleCollapseExpanded,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useTierListDragAndDrop({
    activeId,
    setActiveId,
    findContainer,
    tierConfig,
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (activeId) {
      document.body.dataset.dragging = "true";
    } else {
      delete document.body.dataset.dragging;
    }
    return () => {
      delete document.body.dataset.dragging;
    };
  }, [activeId]);

  // ---- Submit ----

  const handleSubmit = async () => {
    if (hasActiveUpload()) {
      setSubmitError("Wait for uploads to finish before locking in ranking.");
      return;
    }
    if (creatingItemCount > 0) {
      setSubmitError("Wait for item uploads to finish before locking in ranking.");
      return;
    }
    if (savingItemId || removingItemId) {
      setSubmitError("Finish item changes before locking in ranking.");
      return;
    }

    try {
      await flushPendingTierConfigSave();
    } catch (err) {
      setSubmitError(getErrorMessage(err, "Failed to save tier changes. Please try again."));
      return;
    }

    const votes = getVotes();
    if (votes.length !== totalItems) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiPost(`/api/sessions/${sessionId}/votes`, { participantId, votes });
      await clearStoredDraft();
      setSubmitted(true);
      onSubmitted();
    } catch (err) {
      setSubmitError(getErrorMessage(err, "Failed to submit ranking. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!canSaveTemplate || savingTemplate) return;
    if (hasPendingItemMutations) {
      setSaveTemplateError("Finish item changes before saving this list.");
      return;
    }

    setSavingTemplate(true);
    setSaveTemplateError(null);
    try {
      const result = await apiPost<{ id: string }>(`/api/sessions/${sessionId}/template`, {});
      setSavedTemplateId(result.id);
      onNotice?.({
        tone: "emerald",
        message: savesWorkingTemplate ? "List published." : "List saved.",
        actionHref: `/templates/${result.id}`,
        actionLabel: "Open it",
        durationMs: 5000,
      });
    } catch (err) {
      setSaveTemplateError(getErrorMessage(err, "Could not save this list"));
    } finally {
      setSavingTemplate(false);
    }
  };

  const activeItem = activeId ? items.get(activeId) : null;
  const activeContainer = activeId ? findContainer(activeId) : null;
  const sourceModalItem = sourceModalItemId ? (items.get(sourceModalItemId) ?? null) : null;
  const totalItems = liveItems.length;
  const savesWorkingTemplate = canEditTierConfig && templateIsHidden;
  const saveTemplateActionLabel = savesWorkingTemplate ? "Publish to Lists" : "Save as New List";
  const saveTemplateMobileLabel = savesWorkingTemplate ? "Publish" : "Save List";
  const openSavedTemplateLabel = savesWorkingTemplate ? "Open Published List" : "Open Saved List";
  const openSavedTemplateMobileLabel = "Open";
  const saveTemplateTooltipLabel = savesWorkingTemplate
    ? "Publish the current ranking items as a reusable list."
    : "Save a detached copy of this ranking as a new list.";
  const openSavedTemplateTooltipLabel = savesWorkingTemplate
    ? "Open the published list."
    : "Open the saved list.";
  const uploadsDisabled = userLoading || !userId || submitting || submitted;
  const unrankedEmptyMessage =
    totalItems === 0
      ? canManageItems
        ? "Upload items, then drag them into tiers."
        : canEditTierConfig
          ? "This ranking can't edit items. Start a new ranking to change the lineup."
          : "Waiting for the ranking host to add items."
      : "All items ranked!";
  const uploadCard = canManageItems ? (
    <CombinedAddItemTile
      onAddByUrlClick={() => {
        setAddByUrlSourceError(null);
        setShowAddByUrlSourceModal(true);
      }}
      addByUrlDisabled={uploadsDisabled || hasPendingItemMutations}
      addByUrlDescription="Link item"
      onUploaded={handleUploadedImage}
      onUploadStateChange={handleUploadStateChange}
      multiple
      uploadIdleLabel={
        userLoading
          ? "Getting ready..."
          : uploadsDisabled
            ? "Device needed"
            : showCreatingItemState
              ? "Adding..."
              : "Upload"
      }
      uploadDisabled={uploadsDisabled}
      className="w-[112px] flex-shrink-0 sm:w-[120px] md:w-[128px]"
    />
  ) : null;

  useEffect(() => {
    if (!sourceModalItemId) return;
    if (!items.has(sourceModalItemId)) {
      setSourceModalItemId(null);
      setSourceModalReadOnly(false);
    }
  }, [items, sourceModalItemId]);

  return (
    <div className="flex flex-col">
      <div className="mb-2 space-y-2 sm:mb-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {totalItems >= 2 && (
            <span className="group relative inline-flex">
              <button
                type="button"
                onClick={() => {
                  if (hasPendingItemMutations) {
                    setItemMutationError("Finish item changes before opening Quick Bracket.");
                    return;
                  }
                  setItemMutationError(null);
                  setShowSessionBracket(true);
                }}
                disabled={submitting || hasPendingItemMutations}
                className="peer rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] disabled:opacity-50 sm:px-4 sm:py-1.5"
              >
                <span className="sm:hidden">Bracket</span>
                <span className="hidden sm:inline">Quick Bracket</span>
              </button>
              <ThemedTooltip>Seed item order with quick 1v1 matchups.</ThemedTooltip>
            </span>
          )}
          {canSaveTemplate &&
            (savedTemplateId ? (
              <span className="group relative inline-flex">
                <Link
                  href={`/templates/${savedTemplateId}`}
                  className="peer rounded-lg border border-[var(--state-success-fg)] bg-[var(--state-success-bg)] px-3 py-2 text-sm font-medium text-[var(--state-success-fg)] transition-colors hover:brightness-110 sm:px-4 sm:py-1.5"
                >
                  <span className="sm:hidden">{openSavedTemplateMobileLabel}</span>
                  <span className="hidden sm:inline">{openSavedTemplateLabel}</span>
                </Link>
                <ThemedTooltip>{openSavedTemplateTooltipLabel}</ThemedTooltip>
              </span>
            ) : (
              <span className="group relative inline-flex">
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={saveTemplateActionLocked || hasPendingItemMutations}
                  className="peer rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] disabled:opacity-50 sm:px-4 sm:py-1.5"
                >
                  <span className="sm:hidden">
                    {showSaveTemplateBusyState ? "Saving" : saveTemplateMobileLabel}
                  </span>
                  <span className="hidden sm:inline">
                    {showSaveTemplateBusyState ? "Saving..." : saveTemplateActionLabel}
                  </span>
                </button>
                <ThemedTooltip>{saveTemplateTooltipLabel}</ThemedTooltip>
              </span>
            ))}
          <span className="group relative inline-flex">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                submitActionLocked ||
                hasPendingItemMutations ||
                totalItems === 0 ||
                rankedCount !== totalItems
              }
              className="peer rounded-lg bg-[var(--action-primary-bg)] px-3 py-2 text-sm font-medium text-[var(--action-primary-fg)] transition-colors hover:bg-[var(--action-primary-bg-hover)] disabled:opacity-50 sm:px-5 sm:py-1.5"
            >
              <span className="sm:hidden">Save</span>
              <span className="hidden sm:inline">Lock In Ranking</span>
            </button>
            <ThemedTooltip>Submit and lock in your ranking.</ThemedTooltip>
          </span>
        </div>
        {saveTemplateError && (
          <p className="text-right text-sm text-[var(--state-danger-fg)]">{saveTemplateError}</p>
        )}
        {submitError && (
          <p className="text-right text-sm text-[var(--state-danger-fg)]">{submitError}</p>
        )}
        {userError && canManageItems && (
          <p className="text-right text-sm text-[var(--state-danger-fg)]">{userError}</p>
        )}
        {itemMutationError && (
          <p className="text-right text-sm text-[var(--state-danger-fg)]">{itemMutationError}</p>
        )}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        autoScroll={false}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          ref={containerRef}
          className="relative rounded-lg border border-[var(--border-grid)] touch-pan-y"
        >
          {tierConfig.map((tier, index) => (
            <div key={tier.key} data-tier-key={tier.key}>
              <TierRow
                tierKey={tier.key}
                label={tier.label}
                color={tier.color}
                canEditTier={canEditTierConfig}
                isFirst={index === 0}
                isLast={index === tierConfig.length - 1}
                canDelete={tierConfig.length > 2}
                onLabelChange={(newLabel) => handleLabelChange(tier.key, newLabel)}
                onColorChange={(newColor) => handleColorChange(tier.key, newColor)}
                onMoveUp={() => handleMoveTier(index, -1)}
                onMoveDown={() => handleMoveTier(index, 1)}
                onInsertAbove={() => handleInsertTier(index)}
                onInsertBelow={() => handleInsertTier(index + 1)}
                onDelete={() => handleDeleteTier(tier.key)}
                expandedItemId={expandedItemId}
                onExpandItem={handleExpandItem}
                onCollapseExpanded={handleCollapseExpanded}
                onOpenItemSource={(itemId, readOnly = false) => {
                  setItemMutationError(null);
                  setSourceModalItemId(itemId);
                  setSourceModalReadOnly(readOnly);
                }}
                canEditItemSource={canManageItems}
              />
            </div>
          ))}
        </div>

        {/* Unranked Pool */}
        <div className="flex-shrink-0 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:pb-0">
          <div className="mb-2 flex items-center justify-between">
            <UnrankedHeader />
            <span className="text-xs text-[var(--fg-subtle)] sm:text-sm">
              {rankedCount}/{totalItems} ranked
            </span>
          </div>
          <UnrankedDropZone
            emptyMessage={unrankedEmptyMessage}
            size={canManageItems ? "editable" : "compact"}
            className="mb-2 min-h-[112px]"
            onRemoveItem={!canManageItems ? undefined : handleRemoveLiveItem}
            removingItemId={removingItemId}
            renderItem={
              canManageItems
                ? (item) => (
                    <EditableUnrankedItemCard
                      key={item.id}
                      id={item.id}
                      label={item.label}
                      imageUrl={item.imageUrl}
                      sourceUrl={item.sourceUrl}
                      sourceProvider={item.sourceProvider}
                      sourceNote={item.sourceNote}
                      sourceStartSec={item.sourceStartSec}
                      sourceEndSec={item.sourceEndSec}
                      onSaveLabel={handleSaveLiveItemLabel}
                      onSaveSource={(itemId, next) =>
                        handleSaveLiveItemSource(
                          itemId,
                          next.sourceUrl,
                          next.sourceNote,
                          next.sourceStartSec,
                          next.sourceEndSec,
                          next.resolvedImageUrl,
                          next.itemLabel,
                        )
                      }
                      onRemove={() => {
                        void handleRemoveLiveItem(item.id);
                      }}
                      saving={savingItemId === item.id}
                      removing={removingItemId === item.id}
                      sourceError={savingItemId === item.id ? itemMutationError : null}
                    />
                  )
                : undefined
            }
            onOpenItemSource={(itemId) => {
              setItemMutationError(null);
              setSourceModalItemId(itemId);
              setSourceModalReadOnly(false);
            }}
            canEditItemSource={canManageItems}
            afterItems={uploadCard ?? undefined}
          />
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeItem ? (
            canManageItems && activeContainer === "unranked" ? (
              <EditableUnrankedItemOverlay
                label={activeItem.label}
                imageUrl={activeItem.imageUrl}
              />
            ) : (
              <DraggableItem
                id={activeItem.id}
                label={activeItem.label}
                imageUrl={activeItem.imageUrl}
                sourceUrl={activeItem.sourceUrl}
                sourceProvider={activeItem.sourceProvider}
                overlay
              />
            )
          ) : null}
        </DragOverlay>
      </DndContext>

      {sourceModalItem && (
        <ItemSourceModal
          open
          itemLabel={sourceModalItem.label || "Untitled item"}
          itemImageUrl={sourceModalItem.imageUrl}
          sourceUrl={sourceModalItem.sourceUrl}
          sourceProvider={sourceModalItem.sourceProvider}
          sourceNote={sourceModalItem.sourceNote}
          sourceStartSec={sourceModalItem.sourceStartSec}
          sourceEndSec={sourceModalItem.sourceEndSec}
          editable={canManageItems && !submitting && !submitted && !sourceModalReadOnly}
          saving={savingItemId === sourceModalItem.id}
          error={savingItemId === sourceModalItem.id ? itemMutationError : null}
          onClose={() => {
            setSourceModalItemId(null);
            setSourceModalReadOnly(false);
          }}
          onSave={
            canManageItems && !submitting && !submitted && !sourceModalReadOnly
              ? (next) =>
                  handleSaveLiveItemSource(
                    sourceModalItem.id,
                    next.sourceUrl,
                    next.sourceNote,
                    next.sourceStartSec,
                    next.sourceEndSec,
                    next.resolvedImageUrl,
                    next.itemLabel,
                  )
              : undefined
          }
        />
      )}

      {showSessionBracket && (
        <BracketModal
          items={liveItems}
          onComplete={(rankedIds) => {
            const seeded = seedTiersFromRanking(rankedIds, tierConfig);
            initialize(
              liveItems,
              tierConfig.map((t) => t.key),
              seeded,
              null,
            );
            onNotice?.({
              tone: "emerald",
              message: "Bracket seed applied. You can still move anything before locking it in.",
              durationMs: 3000,
            });
            setShowSessionBracket(false);
          }}
          onCancel={() => setShowSessionBracket(false)}
        />
      )}

      {showAddByUrlSourceModal && (
        <ItemSourceModal
          open
          mode="CREATE_FROM_URL"
          itemLabel="New item"
          itemImageUrl={null}
          sourceUrl={null}
          sourceProvider={null}
          sourceNote={null}
          sourceStartSec={null}
          sourceEndSec={null}
          editable={canManageItems && !submitting && !submitted}
          saving={creatingItemCount > 0}
          error={addByUrlSourceError}
          onClose={() => {
            if (creatingItemCount > 0) return;
            setShowAddByUrlSourceModal(false);
          }}
          onSave={async ({
            sourceUrl,
            sourceNote,
            sourceStartSec,
            sourceEndSec,
            itemLabel,
            resolvedImageUrl,
            resolvedTitle,
          }) => {
            setAddByUrlSourceError(null);
            if (!sourceUrl) {
              setAddByUrlSourceError("Source URL is required.");
              return false;
            }

            try {
              const parsed = parseAnyItemSource(sourceUrl);
              if (!parsed) {
                setAddByUrlSourceError("Enter a valid http(s) URL.");
                return false;
              }
              const imageUrl = resolveItemImageUrlForWrite(resolvedImageUrl, parsed.normalizedUrl);
              const label = normalizeItemLabel(
                itemLabel ??
                  resolvedTitle ??
                  suggestItemLabelFromSourceUrl(parsed.normalizedUrl) ??
                  "Link item",
              );

              const result = await handleAddItemFromUrl({
                label: label || "Link item",
                imageUrl,
                sourceUrl: parsed.normalizedUrl,
                sourceNote,
                sourceStartSec,
                sourceEndSec,
              });
              if (result.created) {
                setShowAddByUrlSourceModal(false);
              } else {
                setAddByUrlSourceError(result.error ?? "Failed to add item");
              }
              return result.created;
            } catch (err) {
              setAddByUrlSourceError(getErrorMessage(err, "Could not add an item from this URL."));
              return false;
            }
          }}
        />
      )}
    </div>
  );
}
