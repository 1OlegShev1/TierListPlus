"use client";

import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ItemSourceModal } from "@/components/items/ItemSourceModal";
import { ImageUploader, type UploadedImage } from "@/components/shared/ImageUploader";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { CloseIcon } from "@/components/ui/icons";
import { Textarea } from "@/components/ui/Textarea";
import { useUser } from "@/hooks/useUser";
import { apiFetch, apiPatch, apiPost, getErrorMessage } from "@/lib/api-client";
import { parseSupportedItemSource } from "@/lib/item-source";
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
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const uploadsDisabled = userLoading || !userId;
  const canSave = !saving && !userLoading && !!userId && !!name.trim() && items.length > 0;

  const addItem = ({ url, suggestedLabel }: UploadedImage) => {
    setPreviewingItemIndex(null);
    setItems((prev) => [...prev, { label: suggestedLabel, imageUrl: url, sortOrder: prev.length }]);
  };

  const updateItemLabel = (index: number, label: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, label } : item)));
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
  ) => {
    const sourceProvider = sourceUrl
      ? (parseSupportedItemSource(sourceUrl)?.provider ?? null)
      : null;
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, sourceUrl, sourceNote, sourceProvider, sourceStartSec, sourceEndSec }
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

  const focusUploadTrigger = () => {
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
    focusUploadTrigger();
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
        <p className="text-sm text-neutral-500">{`Publishing inside ${spaceName ?? "this space"} only.`}</p>
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
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="h-4 w-4 accent-amber-500"
            />
            <div>
              <p className="font-medium">Show in public Lists</p>
              <p className="text-sm text-neutral-500">
                Off by default. Private lists are only visible to you.
              </p>
            </div>
          </label>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex w-full flex-wrap items-center justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => (spaceId ? router.push(`/spaces/${spaceId}`) : router.back())}
          >
            Cancel
          </Button>
          <Button ref={saveButtonRef} type="submit" disabled={!canSave}>
            {saving ? "Saving..." : listId ? "Save List" : "Create List"}
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
        <h3 className="mb-3 text-sm font-medium text-neutral-400">Picks ({items.length})</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item, index) => (
            <div
              key={item.id ?? `new-${index}`}
              ref={(node) => {
                itemCardRefs.current[index] = node;
              }}
              className="group relative rounded-lg border border-neutral-800 bg-neutral-900 p-2"
            >
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-neutral-700 bg-black/70 text-neutral-200 opacity-0 transition-all hover:border-red-500 hover:bg-red-600 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                aria-label={`Remove ${item.label || "pick"}`}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setEditingSourceIndex(index)}
                className={`absolute left-1 top-1 z-10 flex h-7 min-w-7 items-center justify-center gap-1 rounded-full border bg-black/70 px-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 ${
                  item.sourceUrl
                    ? "border-sky-400/80 text-sky-200 hover:border-sky-300 hover:text-sky-100 focus-visible:ring-sky-400/70"
                    : "border-neutral-700 text-neutral-100 hover:border-amber-400 hover:text-amber-300 focus-visible:ring-neutral-500/60"
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
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
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
                className="block w-full overflow-hidden rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
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
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  focusNextItemControl(index, e.currentTarget);
                }}
                className="mt-2 w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm text-white placeholder:text-neutral-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          ))}
          <ImageUploader
            onUploaded={addItem}
            onUploadStateChange={(uploading) => {
              if (!uploading) {
                setPreviewingItemIndex(null);
              }
            }}
            multiple
            className="aspect-square w-full"
            disabled={uploadsDisabled}
            triggerRef={uploadTriggerRef}
            idleLabel={
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
          onSave={async ({ sourceUrl, sourceNote, sourceStartSec, sourceEndSec }) => {
            updateItemSource(
              editingSourceIndex,
              sourceUrl,
              sourceNote,
              sourceStartSec,
              sourceEndSec,
            );
            return true;
          }}
        />
      )}
    </form>
  );
}
