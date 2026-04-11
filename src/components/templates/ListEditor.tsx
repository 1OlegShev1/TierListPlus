"use client";

import { Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ItemSourceModal } from "@/components/items/source-modal/ItemSourceModal";
import { CombinedAddItemTile } from "@/components/shared/CombinedAddItemTile";
import type { UploadedImage } from "@/components/shared/ImageUploader";
import { ListRankingPreviewTeaser } from "@/components/templates/ListRankingPreviewTeaser";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { CloseIcon } from "@/components/ui/icons";
import { Textarea } from "@/components/ui/Textarea";
import { useUser } from "@/hooks/useUser";
import { apiFetch, apiPatch, apiPost, getErrorMessage } from "@/lib/api-client";
import {
  MAX_ITEM_LABEL_LENGTH,
  normalizeItemLabel,
  parseAnyItemSource,
  parseSupportedItemSource,
  resolveItemImageUrlForWrite,
  suggestItemLabelFromSourceUrl,
} from "@/lib/item-source";
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemLabelRefs = useRef<Array<HTMLInputElement | null>>([]);
  const itemCardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const uploadTriggerRef = useRef<HTMLButtonElement>(null);
  const addByUrlTriggerRef = useRef<HTMLButtonElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const [showAddByUrlSourceModal, setShowAddByUrlSourceModal] = useState(false);
  const [addByUrlSourceError, setAddByUrlSourceError] = useState<string | null>(null);
  const [addingByUrl, setAddingByUrl] = useState(false);
  const visibilityFieldName = useId();
  const uploadsDisabled = userLoading || !userId;
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

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    try {
      let id = listId;

      if (!id) {
        const template = await apiPost<{ id: string }>(
          spaceId ? `/api/spaces/${spaceId}/templates` : "/api/templates",
          {
            name,
            description,
            ...(spaceId ? {} : { isPublic }),
          },
        );
        id = template.id;
      } else {
        await apiPatch(`/api/templates/${id}`, {
          name,
          description,
          ...(spaceId ? {} : { isPublic }),
        });
      }

      const existingIds = new Set(initialItems.filter((i) => i.id).map((i) => i.id));

      // Delete removed items
      for (const existing of initialItems) {
        if (existing.id && !items.find((i) => i.id === existing.id)) {
          await apiFetch(`/api/templates/${id}/items/${existing.id}`, { method: "DELETE" });
        }
      }

      // Create or update items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.id && existingIds.has(item.id)) {
          await apiPatch(`/api/templates/${id}/items/${item.id}`, {
            label: item.label,
            imageUrl: item.imageUrl,
            sourceUrl: item.sourceUrl ?? null,
            sourceNote: item.sourceNote ?? null,
            sourceStartSec: item.sourceStartSec ?? null,
            sourceEndSec: item.sourceEndSec ?? null,
            sortOrder: i,
          });
        } else {
          await apiPost(`/api/templates/${id}/items`, {
            label: item.label,
            imageUrl: item.imageUrl,
            sourceUrl: item.sourceUrl ?? undefined,
            sourceNote: item.sourceNote ?? undefined,
            sourceStartSec: item.sourceStartSec ?? undefined,
            sourceEndSec: item.sourceEndSec ?? undefined,
            sortOrder: i,
          });
        }
      }

      router.push(`/templates/${id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not save this list. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void save();
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {spaceId && (
        <p className="text-sm text-[var(--fg-subtle)]">{`Publishing inside ${spaceName ?? "this space"} only.`}</p>
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
          <Button
            variant="secondary"
            onClick={() => (spaceId ? router.push(`/spaces/${spaceId}`) : router.back())}
          >
            Cancel
          </Button>
          <Button ref={saveButtonRef} type="submit" disabled={!canSave}>
            {saving ? "Saving..." : listId ? "Save List Picks" : "Create List"}
          </Button>
        </div>

        {(userError || error) && (
          <div className="space-y-2">
            {userError && <ErrorMessage message={userError} />}
            {error && <ErrorMessage message={error} />}
            {userError && (
              <Button variant="secondary" onClick={retryUser}>
                Retry Device Setup
              </Button>
            )}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-[var(--fg-muted)]">Picks ({items.length})</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item, index) => (
            <div
              key={item.id ?? `new-${index}`}
              ref={(node) => {
                itemCardRefs.current[index] = node;
              }}
              className="group relative rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2"
            >
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-media-overlay)] text-[var(--fg-on-media-overlay)] opacity-0 transition-all hover:border-[var(--action-danger-bg)] hover:bg-[var(--action-danger-bg)] hover:text-[var(--action-danger-fg)] focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                aria-label={`Remove ${item.label || "pick"}`}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setEditingSourceIndex(index)}
                className={`absolute left-1 top-1 z-10 flex h-7 min-w-7 items-center justify-center gap-1 rounded-full border px-2 text-xs font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                  item.sourceUrl
                    ? "border-[var(--source-control-linked-border)] bg-[var(--source-control-linked-bg)] text-[var(--source-control-linked-fg)] hover:border-[var(--source-control-linked-border-hover)] hover:bg-[var(--source-control-linked-bg-hover)] hover:text-[var(--source-control-linked-fg-hover)]"
                    : "border-[var(--source-control-unlinked-border)] bg-[var(--source-control-unlinked-bg)] text-[var(--source-control-unlinked-fg)] hover:border-[var(--source-control-unlinked-border-hover)] hover:bg-[var(--source-control-unlinked-bg-hover)] hover:text-[var(--source-control-unlinked-fg-hover)]"
                } ${
                  item.sourceUrl
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                }`}
                aria-label={
                  item.sourceUrl
                    ? `Open source for ${item.label || "pick"}`
                    : `Add source for ${item.label || "pick"}`
                }
                title={item.sourceUrl ? "Open source link" : "Add source link"}
              >
                <Link2 className="h-4 w-4" aria-hidden="true" />
                {item.sourceUrl ? "See" : "Add"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setPreviewingItemIndex((current) => (current === index ? null : index))
                }
                onBlur={(event) => {
                  const card = itemCardRefs.current[index];
                  const nextFocused = event.relatedTarget;
                  if (card && nextFocused instanceof Node && card.contains(nextFocused)) return;
                  setPreviewingItemIndex((current) => (current === index ? null : current));
                }}
                className="block w-full overflow-hidden rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)]"
                aria-label={`Preview animation for ${item.label || "pick"}`}
              >
                <ItemArtwork
                  src={item.imageUrl}
                  alt={item.label}
                  className="aspect-square w-full rounded"
                  presentation="ambient"
                  inset="compact"
                  animate={previewingItemIndex === index}
                  showAnimatedHint
                />
              </button>
              <input
                ref={(node) => {
                  itemLabelRefs.current[index] = node;
                }}
                type="text"
                placeholder="Name this pick"
                value={item.label}
                onChange={(e) => updateItemLabel(index, e.target.value)}
                maxLength={MAX_ITEM_LABEL_LENGTH}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  focusNextItemControl(index, e.currentTarget);
                }}
                className="mt-2 w-full rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm text-[var(--fg-primary)] placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
            </div>
          ))}
          <CombinedAddItemTile
            onAddByUrlClick={() => {
              setAddByUrlSourceError(null);
              setShowAddByUrlSourceModal(true);
            }}
            addByUrlDisabled={uploadsDisabled}
            addByUrlTriggerRef={addByUrlTriggerRef}
            onUploaded={addItem}
            onUploadStateChange={(uploading) => {
              if (!uploading) {
                setPreviewingItemIndex(null);
              }
            }}
            multiple
            className="w-full"
            matchUploadedItemCardHeight
            labelPlaceholder="Name this pick"
            uploadDisabled={uploadsDisabled}
            uploadTriggerRef={uploadTriggerRef}
            uploadIdleLabel={
              userLoading ? "Getting ready..." : uploadsDisabled ? "Device needed" : undefined
            }
          />
        </div>
      </div>

      {editingSourceIndex != null && items[editingSourceIndex] && (
        <ItemSourceModal
          open
          itemLabel={items[editingSourceIndex].label || "Untitled item"}
          itemImageUrl={items[editingSourceIndex].imageUrl}
          sourceUrl={items[editingSourceIndex].sourceUrl}
          sourceProvider={items[editingSourceIndex].sourceProvider}
          sourceNote={items[editingSourceIndex].sourceNote}
          sourceStartSec={items[editingSourceIndex].sourceStartSec}
          sourceEndSec={items[editingSourceIndex].sourceEndSec}
          editable
          onClose={() => setEditingSourceIndex(null)}
          onSave={async ({
            sourceUrl,
            sourceNote,
            sourceStartSec,
            sourceEndSec,
            itemLabel,
            resolvedImageUrl,
          }) => {
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
          }}
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
          editable
          saving={addingByUrl}
          error={addByUrlSourceError}
          onClose={() => {
            if (addingByUrl) return;
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
          }}
        />
      )}
    </form>
  );
}
