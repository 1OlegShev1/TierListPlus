import { useCallback, useState } from "react";
import { apiFetch, apiPatch, apiPost, getErrorMessage } from "@/lib/api-client";
import type { TemplateItemData } from "@/types";

interface UseListEditorSaveParams {
  listId?: string;
  spaceId?: string | null;
  initialItems: TemplateItemData[];
  items: TemplateItemData[];
  name: string;
  description: string;
  isPublic: boolean;
  clearStoredDraft: () => Promise<void>;
  onSaved: (templateId: string) => void;
}

interface UseListEditorSaveResult {
  error: string | null;
  save: () => Promise<void>;
  saving: boolean;
}

export function useListEditorSave({
  listId,
  spaceId,
  initialItems,
  items,
  name,
  description,
  isPublic,
  clearStoredDraft,
  onSaved,
}: UseListEditorSaveParams): UseListEditorSaveResult {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async () => {
    if (saving) return;
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

      if (!id) {
        throw new Error("Template id missing after save.");
      }

      const existingIds = new Set(initialItems.filter((item) => item.id).map((item) => item.id));

      // Delete removed items.
      for (const existing of initialItems) {
        if (existing.id && !items.find((item) => item.id === existing.id)) {
          await apiFetch(`/api/templates/${id}/items/${existing.id}`, { method: "DELETE" });
        }
      }

      // Create new items and update existing ones in list order.
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (item.id && existingIds.has(item.id)) {
          await apiPatch(`/api/templates/${id}/items/${item.id}`, {
            label: item.label,
            imageUrl: item.imageUrl,
            sourceUrl: item.sourceUrl ?? null,
            sourceNote: item.sourceNote ?? null,
            sourceStartSec: item.sourceStartSec ?? null,
            sourceEndSec: item.sourceEndSec ?? null,
            sortOrder: index,
          });
        } else {
          await apiPost(`/api/templates/${id}/items`, {
            label: item.label,
            imageUrl: item.imageUrl,
            sourceUrl: item.sourceUrl ?? undefined,
            sourceNote: item.sourceNote ?? undefined,
            sourceStartSec: item.sourceStartSec ?? undefined,
            sourceEndSec: item.sourceEndSec ?? undefined,
            sortOrder: index,
          });
        }
      }

      await clearStoredDraft();
      onSaved(id);
    } catch (err) {
      setError(getErrorMessage(err, "Could not save this list. Try again."));
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    listId,
    spaceId,
    name,
    description,
    isPublic,
    initialItems,
    items,
    clearStoredDraft,
    onSaved,
  ]);

  return { saving, error, save };
}
