"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { UploadedImage } from "@/components/shared/ImageUploader";
import {
  ListEditorDialogs,
  type ListEditorSourceModalSavePayload,
} from "@/components/templates/ListEditorDialogs";
import { ListEditorItemsGrid } from "@/components/templates/ListEditorItemsGrid";
import { ListRankingPreviewTeaser } from "@/components/templates/ListRankingPreviewTeaser";
import { useListEditorDrafts } from "@/components/templates/useListEditorDrafts";
import { useListEditorSave } from "@/components/templates/useListEditorSave";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useUser } from "@/hooks/useUser";
import { getErrorMessage } from "@/lib/api-client";
import {
  normalizeItemLabel,
  parseAnyItemSource,
  parseSupportedItemSource,
  resolveItemImageUrlForWrite,
  suggestItemLabelFromSourceUrl,
} from "@/lib/item-source";
import type { ListEditorDraftSnapshot } from "@/lib/list-draft-storage";
import type { TemplateItemData } from "@/types";

interface ListEditorProps {
  listId?: string;
  spaceId?: string | null;
  spaceName?: string | null;
  initialName?: string;
  initialDescription?: string;
  initialIsPublic?: boolean;
  initialItems?: TemplateItemData[];
}

export function ListEditor({
  listId,
  spaceId = null,
  spaceName = null,
  initialName = "",
  initialDescription = "",
  initialIsPublic = false,
  initialItems = [],
}: ListEditorProps) {
  const router = useRouter();
  const { userId, isLoading: userLoading, error: userError, retry: retryUser } = useUser();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [items, setItems] = useState<TemplateItemData[]>(initialItems);
  const [previewingItemIndex, setPreviewingItemIndex] = useState<number | null>(null);
  const [editingSourceIndex, setEditingSourceIndex] = useState<number | null>(null);
  const itemLabelRefs = useRef<Array<HTMLInputElement | null>>([]);
  const itemCardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const uploadTriggerRef = useRef<HTMLButtonElement>(null);
  const addByUrlTriggerRef = useRef<HTMLButtonElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const [showAddByUrlSourceModal, setShowAddByUrlSourceModal] = useState(false);
  const [addByUrlSourceError, setAddByUrlSourceError] = useState<string | null>(null);
  const [addingByUrl, setAddingByUrl] = useState(false);
  const [showCancelDraftDialog, setShowCancelDraftDialog] = useState(false);
  const visibilityFieldName = useId();
  const uploadsDisabled = userLoading || !userId;
  const cancelDraftDialogHandledRef = useRef(false);

  const applyEditorSnapshot = useCallback((snapshot: ListEditorDraftSnapshot) => {
    setName(snapshot.name);
    setDescription(snapshot.description);
    setIsPublic(snapshot.isPublic);
    setItems(snapshot.items);
    setPreviewingItemIndex(null);
    setEditingSourceIndex(null);
  }, []);

  const { isDirty, draftNotice, clearStoredDraft, discardDraftAndReset } = useListEditorDrafts({
    userId,
    userLoading,
    listId,
    spaceId,
    initialName,
    initialDescription,
    initialIsPublic,
    initialItems,
    name,
    description,
    isPublic,
    items,
    onApplySnapshot: applyEditorSnapshot,
  });

  const handleSaved = useCallback(
    (templateId: string) => {
      router.push(`/templates/${templateId}`);
    },
    [router],
  );

  const {
    save,
    saving,
    error: saveError,
  } = useListEditorSave({
    listId,
    spaceId,
    initialItems,
    items,
    name,
    description,
    isPublic,
    clearStoredDraft,
    onSaved: handleSaved,
  });
  const canSave = !saving && !userLoading && !!userId && !!name.trim() && items.length > 0;

  const addItem = ({ url, suggestedLabel }: UploadedImage) => {
    setPreviewingItemIndex(null);
    setItems((prev) => [
      ...prev,
      {
        label: normalizeItemLabel(suggestedLabel) || "New item",
        imageUrl: url,
        sortOrder: prev.length,
      },
    ]);
  };

  const updateItemLabel = (index: number, label: string) => {
    const nextLabel = normalizeItemLabel(label);
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, label: nextLabel } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setPreviewingItemIndex((current) => {
      if (current == null) return null;
      if (current === index) return null;
      return current > index ? current - 1 : current;
    });
    setEditingSourceIndex((current) => {
      if (current == null) return null;
      if (current === index) return null;
      return current > index ? current - 1 : current;
    });
  };

  const updateItemSource = (
    index: number,
    sourceUrl: string | null,
    sourceNote: string | null,
    sourceStartSec: number | null,
    sourceEndSec: number | null,
    imageUrl?: string | null,
    label?: string | null,
  ) => {
    const sourceProvider = sourceUrl
      ? (parseSupportedItemSource(sourceUrl)?.provider ?? null)
      : null;
    const normalizedLabel =
      label !== undefined && label !== null ? normalizeItemLabel(label) : null;
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              ...(imageUrl ? { imageUrl } : {}),
              ...(normalizedLabel !== null ? { label: normalizedLabel } : {}),
              sourceUrl,
              sourceNote,
              sourceProvider,
              sourceStartSec,
              sourceEndSec,
            }
          : item,
      ),
    );
  };

  useEffect(() => {
    if (previewingItemIndex == null) return;
    if (previewingItemIndex >= items.length) {
      setPreviewingItemIndex(null);
    }
  }, [items.length, previewingItemIndex]);

  useEffect(() => {
    if (previewingItemIndex == null) return;

    const handlePointerDown = (event: PointerEvent) => {
      const activeCard = itemCardRefs.current[previewingItemIndex];
      if (!activeCard) {
        setPreviewingItemIndex(null);
        return;
      }
      if (event.target instanceof Node && activeCard.contains(event.target)) return;
      setPreviewingItemIndex(null);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [previewingItemIndex]);

  const focusNextItemControl = (index: number, currentInput: HTMLInputElement) => {
    const nextLabel = itemLabelRefs.current.slice(index + 1).find((input) => input != null);
    if (nextLabel) {
      nextLabel.focus();
      return;
    }

    const addByUrlTrigger = addByUrlTriggerRef.current;
    if (addByUrlTrigger && !addByUrlTrigger.disabled) {
      addByUrlTrigger.focus();
      return;
    }

    const uploadTrigger = uploadTriggerRef.current;
    if (uploadTrigger && !uploadTrigger.disabled) {
      uploadTrigger.focus();
      return;
    }

    const saveButton = saveButtonRef.current;
    if (saveButton && !saveButton.disabled) {
      saveButton.focus();
      return;
    }

    currentInput.blur();
  };

  const focusPrimaryAddTrigger = () => {
    const addByUrlTrigger = addByUrlTriggerRef.current;
    if (addByUrlTrigger && !addByUrlTrigger.disabled) {
      addByUrlTrigger.focus();
      return;
    }

    const uploadTrigger = uploadTriggerRef.current;
    if (uploadTrigger && !uploadTrigger.disabled) {
      uploadTrigger.focus();
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.key !== "Enter") return;
    if (canSave) return;
    if (items.length > 0) return;

    e.preventDefault();
    focusPrimaryAddTrigger();
  };

  const navigateAway = useCallback(() => {
    if (spaceId) {
      router.push(`/spaces/${spaceId}`);
      return;
    }
    router.back();
  }, [router, spaceId]);

  const handleCancel = () => {
    if (!isDirty) {
      navigateAway();
      return;
    }
    cancelDraftDialogHandledRef.current = false;
    setShowCancelDraftDialog(true);
  };

  const handleCancelDraftDialogChoice = (choice: "keep" | "discard") => {
    if (cancelDraftDialogHandledRef.current) return;
    cancelDraftDialogHandledRef.current = true;

    if (choice === "keep") {
      setShowCancelDraftDialog(false);
      navigateAway();
      return;
    }

    void (async () => {
      await discardDraftAndReset();
      setShowCancelDraftDialog(false);
      navigateAway();
    })();
  };

  const handleOpenAddByUrl = () => {
    setAddByUrlSourceError(null);
    setShowAddByUrlSourceModal(true);
  };

  const handleCloseAddByUrl = () => {
    if (addingByUrl) return;
    setShowAddByUrlSourceModal(false);
  };

  const handleSaveEditingSource = async ({
    sourceUrl,
    sourceNote,
    sourceStartSec,
    sourceEndSec,
    itemLabel,
    resolvedImageUrl,
  }: ListEditorSourceModalSavePayload) => {
    if (editingSourceIndex == null) return false;
    updateItemSource(
      editingSourceIndex,
      sourceUrl,
      sourceNote,
      sourceStartSec,
      sourceEndSec,
      resolvedImageUrl,
      itemLabel,
    );
    return true;
  };

  const handleSaveAddByUrl = async ({
    sourceUrl,
    sourceNote,
    sourceStartSec,
    sourceEndSec,
    itemLabel,
    resolvedImageUrl,
    resolvedTitle,
  }: ListEditorSourceModalSavePayload) => {
    setAddByUrlSourceError(null);
    if (!sourceUrl) {
      setAddByUrlSourceError("Source URL is required.");
      return false;
    }

    setAddingByUrl(true);
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

      setPreviewingItemIndex(null);
      setItems((prev) => [
        ...prev,
        {
          label: label || "Link item",
          imageUrl,
          sourceUrl: parsed.normalizedUrl,
          sourceProvider: parsed.provider,
          sourceNote,
          sourceStartSec,
          sourceEndSec,
          sortOrder: prev.length,
        },
      ]);
      setShowAddByUrlSourceModal(false);
      return true;
    } catch (err) {
      setAddByUrlSourceError(getErrorMessage(err, "Could not add an item from this URL."));
      return false;
    } finally {
      setAddingByUrl(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSave || saving) return;
    void save();
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {spaceId && (
        <p className="text-sm text-[var(--fg-subtle)]">{`Publishing inside ${spaceName ?? "this space"} only.`}</p>
      )}
      {draftNotice && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-soft-contrast)] px-3 py-2 text-sm">
          <p className="text-[var(--fg-secondary)]">{draftNotice}</p>
          <Button
            variant="secondary"
            size="equalAction"
            onClick={() => {
              void discardDraftAndReset();
            }}
          >
            Discard draft
          </Button>
        </div>
      )}
      <div className="space-y-4">
        <Input
          type="text"
          placeholder="List name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleNameKeyDown}
          autoFocus={!listId}
          className="w-full text-lg"
        />
        <Textarea
          placeholder="What are people ranking? (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full text-sm"
        />
      </div>

      <div>
        {!spaceId && (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
            <p className="font-medium">Show in public Lists</p>
            <div className="mt-3">
              <fieldset className="relative inline-grid h-11 min-w-[11rem] grid-cols-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-soft-contrast)] p-1">
                <legend className="sr-only">List visibility</legend>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-sm transition-transform duration-200 ${
                    isPublic ? "translate-x-full" : "translate-x-0"
                  }`}
                />
                <label
                  className={`relative z-10 flex cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium transition-colors ${
                    !isPublic
                      ? "text-[var(--fg-primary)]"
                      : "text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]"
                  }`}
                >
                  <input
                    type="radio"
                    name={visibilityFieldName}
                    value="PRIVATE"
                    checked={!isPublic}
                    onChange={() => setIsPublic(false)}
                    className="sr-only"
                  />
                  Private
                </label>
                <label
                  className={`relative z-10 flex cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium transition-colors ${
                    isPublic
                      ? "text-[var(--fg-primary)]"
                      : "text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]"
                  }`}
                >
                  <input
                    type="radio"
                    name={visibilityFieldName}
                    value="PUBLIC"
                    checked={isPublic}
                    onChange={() => setIsPublic(true)}
                    className="sr-only"
                  />
                  Public
                </label>
              </fieldset>
            </div>
            <p className="mt-3 text-sm text-[var(--fg-subtle)]">
              Off by default. Private lists are only visible to you.
            </p>
            <p className="text-xs text-[var(--fg-subtle)]">
              If you publish, you confirm you have rights to the content and links you share.
            </p>
          </div>
        )}
      </div>

      <ListRankingPreviewTeaser items={items} />

      <div className="space-y-2">
        <div className="flex w-full flex-wrap items-center justify-end gap-3">
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button ref={saveButtonRef} type="submit" disabled={!canSave}>
            {saving ? "Saving..." : listId ? "Save List Picks" : "Create List"}
          </Button>
        </div>

        {(userError || saveError) && (
          <div className="space-y-2">
            {userError && <ErrorMessage message={userError} />}
            {saveError && <ErrorMessage message={saveError} />}
            {userError && (
              <Button variant="secondary" onClick={retryUser}>
                Retry Device Setup
              </Button>
            )}
          </div>
        )}
      </div>

      <ListEditorItemsGrid
        addByUrlTriggerRef={addByUrlTriggerRef}
        itemCardRefs={itemCardRefs}
        itemLabelRefs={itemLabelRefs}
        items={items}
        previewingItemIndex={previewingItemIndex}
        uploadsDisabled={uploadsDisabled}
        userLoading={userLoading}
        uploadTriggerRef={uploadTriggerRef}
        onRemoveItem={removeItem}
        onOpenItemSource={setEditingSourceIndex}
        onCloseItemPreview={(index) => {
          setPreviewingItemIndex((current) => (current === index ? null : current));
        }}
        onToggleItemPreview={(index) => {
          setPreviewingItemIndex((current) => (current === index ? null : index));
        }}
        onUpdateItemLabel={updateItemLabel}
        onLabelEnter={focusNextItemControl}
        onOpenAddByUrl={handleOpenAddByUrl}
        onUploaded={addItem}
        onUploadStateChange={(uploading) => {
          if (!uploading) {
            setPreviewingItemIndex(null);
          }
        }}
      />

      <ListEditorDialogs
        addByUrlSourceError={addByUrlSourceError}
        addingByUrl={addingByUrl}
        editingSourceItem={editingSourceIndex != null ? (items[editingSourceIndex] ?? null) : null}
        showAddByUrlSourceModal={showAddByUrlSourceModal}
        showCancelDraftDialog={showCancelDraftDialog}
        onCloseEditingSource={() => setEditingSourceIndex(null)}
        onSaveEditingSource={handleSaveEditingSource}
        onCloseAddByUrl={handleCloseAddByUrl}
        onSaveAddByUrl={handleSaveAddByUrl}
        onCancelDraftChoice={handleCancelDraftDialogChoice}
      />
    </form>
  );
}
