"use client";

import { DndContext, DragOverlay } from "@dnd-kit/core";
import dynamic from "next/dynamic";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { CloseIcon } from "@/components/ui/icons";
import { useDelayedBusy } from "@/hooks/useDelayedBusy";
import { useTierListStore } from "@/hooks/useTierList";
import { useUser } from "@/hooks/useUser";
import { apiPost, getErrorMessage } from "@/lib/api-client";
import { clearDraft, getDraft, saveDraft } from "@/lib/vote-draft";
import type { Item, TierConfig } from "@/types";
import { DraggableItem } from "./DraggableItem";
import { EditableUnrankedItemCard } from "./EditableUnrankedItemCard";
import { TierRow } from "./TierRow";
import { UnrankedDropZone, UnrankedHeader } from "./UnrankedPool";
import { useLiveSessionItems } from "./useLiveSessionItems";
import { useTierConfigEditor } from "./useTierConfigEditor";
import { useTierListDragAndDrop } from "./useTierListDragAndDrop";

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
}

/** Evenly distribute a ranked list across tiers from top to bottom. */
function seedTiersFromRanking(
  rankedIds: string[],
  tierConfig: TierConfig[],
): Record<string, string[]> {
  const sortedTiers = [...tierConfig].sort((a, b) => a.sortOrder - b.sortOrder);
  const tierCount = sortedTiers.length;
  const itemCount = rankedIds.length;
  const baseSize = Math.floor(itemCount / tierCount);
  const remainder = itemCount % tierCount;

  const seededTiers: Record<string, string[]> = {};
  let cursor = 0;

  for (let i = 0; i < tierCount; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    seededTiers[sortedTiers[i].key] = rankedIds.slice(cursor, cursor + size);
    cursor += size;
  }

  return seededTiers;
}

function useAutoDismissFlag(isVisible: boolean, dismiss: () => void, delayMs: number) {
  useEffect(() => {
    if (!isVisible) return;
    const timeout = setTimeout(dismiss, delayMs);
    return () => clearTimeout(timeout);
  }, [delayMs, dismiss, isVisible]);
}

function StatusNotice({
  tone,
  children,
  onDismiss,
}: {
  tone: "amber" | "emerald";
  children: ReactNode;
  onDismiss: () => void;
}) {
  const toneClassName =
    tone === "emerald"
      ? "border-emerald-500/40 text-emerald-100 shadow-[0_12px_36px_-22px_rgba(16,185,129,0.9)]"
      : "border-amber-500/40 text-amber-100 shadow-[0_12px_36px_-22px_rgba(245,158,11,0.95)]";
  const toneButtonClassName =
    tone === "emerald"
      ? "text-emerald-200/70 hover:bg-emerald-500/10 hover:text-emerald-100"
      : "text-amber-200/70 hover:bg-amber-500/10 hover:text-amber-100";

  return (
    <div
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-neutral-950/90 px-3 py-2 text-sm leading-5 backdrop-blur-sm sm:w-[22rem] ${toneClassName}`}
    >
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={onDismiss}
        className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-colors ${toneButtonClassName}`}
        aria-label="Dismiss notice"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
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
}: TierListBoardProps) {
  const { userId, isLoading: userLoading, error: userError } = useUser();
  const {
    initialize,
    setActiveId,
    activeId,
    items,
    findContainer,
    tiers,
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
  const [draftRestored, setDraftRestored] = useState(false);
  const [bracketSeeded, setBracketSeeded] = useState(false);
  const [showSessionBracket, setShowSessionBracket] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveTemplateError, setSaveTemplateError] = useState<string | null>(null);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [showSavedTemplateNotice, setShowSavedTemplateNotice] = useState(false);
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
    handleSaveLiveItemLabel,
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

  // Initialize Zustand store only once on mount (restore draft if available)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const validIds = new Set(sessionItems.map((i) => i.id));
    const draft = getDraft(sessionId, participantId, validIds);

    initialize(
      sessionItems,
      initialTierConfig.map((t) => t.key),
      seededTiers,
      draft,
    );

    if (draft) setDraftRestored(true);
  }, [sessionItems, initialTierConfig, seededTiers, initialize, sessionId, participantId]);

  // Auto-save draft to localStorage on every tier/unranked change
  useEffect(() => {
    // Skip until store is initialized
    if (!initializedRef.current) return;

    let timeout: ReturnType<typeof setTimeout>;
    const unsub = useTierListStore.subscribe((state) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        saveDraft(sessionId, participantId, {
          tiers: state.tiers,
          unranked: state.unranked,
        });
      }, 300);
    });

    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, [sessionId, participantId]);

  // Warn before leaving with unsaved ranked items.
  // Disable this guard while submit is in-flight and after successful submit.
  const rankedCount = Object.values(tiers).reduce((sum, ids) => sum + ids.length, 0);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    if (rankedCount > 0 && !submitting && !submitted) {
      window.addEventListener("beforeunload", handler);
    }
    return () => window.removeEventListener("beforeunload", handler);
  }, [rankedCount, submitting, submitted]);

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
      clearDraft(sessionId, participantId);
      setSubmitted(true);
      onSubmitted();
    } catch (err) {
      setSubmitError(getErrorMessage(err, "Failed to submit votes. Please try again."));
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
      setShowSavedTemplateNotice(true);
    } catch (err) {
      setSaveTemplateError(getErrorMessage(err, "Could not save this list"));
    } finally {
      setSavingTemplate(false);
    }
  };

  const activeItem = activeId ? items.get(activeId) : null;
  const liveItems = initializedRef.current ? Array.from(items.values()) : sessionItems;
  const totalItems = liveItems.length;
  const savesWorkingTemplate = canEditTierConfig && templateIsHidden;
  const saveTemplateActionLabel = savesWorkingTemplate ? "Publish to Lists" : "Save as New List";
  const saveTemplateMobileLabel = savesWorkingTemplate ? "Publish" : "Save List";
  const openSavedTemplateLabel = savesWorkingTemplate ? "Open Published List" : "Open Saved List";
  const openSavedTemplateMobileLabel = "Open";
  const uploadsDisabled = userLoading || !userId || submitting || submitted;
  const unrankedEmptyMessage =
    totalItems === 0
      ? canManageItems
        ? "Upload items, then drag them into tiers."
        : canEditTierConfig
          ? "This vote can't edit items. Start a new vote to change the lineup."
          : "Waiting for the vote host to add items."
      : "All items ranked!";
  const uploadCard = canManageItems ? (
    <div className="w-[112px] flex-shrink-0 rounded-lg border border-neutral-700 bg-neutral-950 p-1.5 sm:w-[120px] md:w-[128px]">
      <ImageUploader
        onUploaded={handleUploadedImage}
        onUploadStateChange={handleUploadStateChange}
        multiple
        idleLabel={
          userLoading
            ? "Getting ready..."
            : uploadsDisabled
              ? "Device needed"
              : showCreatingItemState
                ? "Adding..."
                : "Upload"
        }
        disabled={uploadsDisabled}
        className="aspect-square w-full"
      />
      <div aria-hidden="true" className="mt-1 h-[30px]" />
    </div>
  ) : null;

  useAutoDismissFlag(draftRestored, () => setDraftRestored(false), 3000);
  useAutoDismissFlag(bracketSeeded, () => setBracketSeeded(false), 3000);
  useAutoDismissFlag(showSavedTemplateNotice, () => setShowSavedTemplateNotice(false), 5000);

  return (
    <div className="relative flex flex-col">
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 flex justify-center sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:z-30 sm:justify-end"
      >
        <div className="flex w-full max-w-[22rem] flex-col gap-2">
          {draftRestored && (
            <StatusNotice tone="amber" onDismiss={() => setDraftRestored(false)}>
              Draft restored.
            </StatusNotice>
          )}
          {bracketSeeded && (
            <StatusNotice tone="emerald" onDismiss={() => setBracketSeeded(false)}>
              Bracket seed applied. You can still move anything before locking it in.
            </StatusNotice>
          )}
          {savedTemplateId && showSavedTemplateNotice && (
            <StatusNotice tone="emerald" onDismiss={() => setShowSavedTemplateNotice(false)}>
              {savesWorkingTemplate ? "List published." : "List saved."}{" "}
              <Link
                href={`/templates/${savedTemplateId}`}
                className="font-medium underline underline-offset-2 hover:text-white"
              >
                Open it
              </Link>
            </StatusNotice>
          )}
        </div>
      </div>
      <div className="mb-2 space-y-2 sm:mb-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {totalItems >= 2 && (
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
              className="rounded-lg border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-amber-400 hover:text-amber-300 disabled:opacity-50 sm:px-4 sm:py-1.5"
            >
              <span className="sm:hidden">Bracket</span>
              <span className="hidden sm:inline">Quick Bracket</span>
            </button>
          )}
          {canSaveTemplate &&
            (savedTemplateId ? (
              <Link
                href={`/templates/${savedTemplateId}`}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200 transition-colors hover:border-emerald-400 hover:text-emerald-100 sm:px-4 sm:py-1.5"
              >
                <span className="sm:hidden">{openSavedTemplateMobileLabel}</span>
                <span className="hidden sm:inline">{openSavedTemplateLabel}</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={saveTemplateActionLocked || hasPendingItemMutations}
                className="rounded-lg border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-50 sm:px-4 sm:py-1.5"
              >
                <span className="sm:hidden">
                  {showSaveTemplateBusyState ? "Saving" : saveTemplateMobileLabel}
                </span>
                <span className="hidden sm:inline">
                  {showSaveTemplateBusyState ? "Saving..." : saveTemplateActionLabel}
                </span>
              </button>
            ))}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              submitActionLocked ||
              hasPendingItemMutations ||
              totalItems === 0 ||
              rankedCount !== totalItems
            }
            className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-50 sm:px-5 sm:py-1.5"
          >
            <span className="sm:hidden">Save</span>
            <span className="hidden sm:inline">Lock In Ranking</span>
          </button>
        </div>
        {saveTemplateError && (
          <p className="text-right text-sm text-red-400">{saveTemplateError}</p>
        )}
        {submitError && <p className="text-right text-sm text-red-400">{submitError}</p>}
        {userError && canManageItems && (
          <p className="text-right text-sm text-red-400">{userError}</p>
        )}
        {itemMutationError && (
          <p className="text-right text-sm text-red-400">{itemMutationError}</p>
        )}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          ref={containerRef}
          className="relative rounded-lg border border-neutral-800 touch-pan-y"
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
                expandedItemId={canManageItems ? null : expandedItemId}
                onExpandItem={canManageItems ? () => {} : handleExpandItem}
                onCollapseExpanded={canManageItems ? () => {} : handleCollapseExpanded}
              />
            </div>
          ))}
        </div>

        {/* Unranked Pool */}
        <div className="flex-shrink-0 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:pb-0">
          <div className="mb-2 flex items-center justify-between">
            <UnrankedHeader />
            <span className="text-xs text-neutral-500 sm:text-sm">
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
                      onSaveLabel={handleSaveLiveItemLabel}
                      onRemove={() => {
                        void handleRemoveLiveItem(item.id);
                      }}
                      saving={savingItemId === item.id}
                      removing={removingItemId === item.id}
                    />
                  )
                : undefined
            }
            afterItems={uploadCard ?? undefined}
          />
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeItem ? (
            <DraggableItem
              id={activeItem.id}
              label={activeItem.label}
              imageUrl={activeItem.imageUrl}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

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
            setBracketSeeded(true);
            setShowSessionBracket(false);
          }}
          onCancel={() => setShowSessionBracket(false)}
        />
      )}
    </div>
  );
}
