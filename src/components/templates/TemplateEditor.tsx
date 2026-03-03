"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useUser } from "@/hooks/useUser";
import { apiFetch, apiPatch, apiPost, getErrorMessage } from "@/lib/api-client";
import type { TemplateItemData } from "@/types";

interface TemplateEditorProps {
  templateId?: string;
  initialName?: string;
  initialDescription?: string;
  initialIsPublic?: boolean;
  initialItems?: TemplateItemData[];
}

export function TemplateEditor({
  templateId,
  initialName = "",
  initialDescription = "",
  initialIsPublic = false,
  initialItems = [],
}: TemplateEditorProps) {
  const router = useRouter();
  const { userId, isLoading: userLoading, error: userError, retry: retryUser } = useUser();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [items, setItems] = useState<TemplateItemData[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addItem = (imageUrl: string) => {
    setItems((prev) => [...prev, { label: "", imageUrl, sortOrder: prev.length }]);
  };

  const updateItemLabel = (index: number, label: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, label } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    if (!name.trim() || userLoading || !userId) return;
    setSaving(true);
    setError(null);

    try {
      let id = templateId;

      if (!id) {
        const template = await apiPost<{ id: string }>("/api/templates", {
          name,
          description,
          isPublic,
        });
        id = template.id;
      } else {
        await apiPatch(`/api/templates/${id}`, { name, description, isPublic });
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
            sortOrder: i,
          });
        } else {
          await apiPost(`/api/templates/${id}/items`, {
            label: item.label,
            imageUrl: item.imageUrl,
            sortOrder: i,
          });
        }
      }

      router.push(`/templates/${id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Input
          type="text"
          placeholder="Template name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full text-lg"
        />
        <Textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full text-sm"
        />
      </div>

      <div>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4 accent-amber-500"
          />
          <div>
            <p className="font-medium">Show in public Templates list</p>
            <p className="text-sm text-neutral-500">
              Disabled by default. Private templates are only visible to you.
            </p>
          </div>
        </label>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-neutral-400">Items ({items.length})</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item, index) => (
            <div
              key={item.id ?? `new-${index}`}
              className="group relative rounded-lg border border-neutral-800 bg-neutral-900 p-2"
            >
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="absolute -right-2 -top-2 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white group-hover:flex"
                aria-label={`Remove ${item.label || "item"}`}
              >
                x
              </button>
              <img
                src={item.imageUrl}
                alt={item.label}
                className="aspect-square w-full rounded object-cover"
              />
              <input
                type="text"
                placeholder="Label"
                value={item.label}
                onChange={(e) => updateItemLabel(index, e.target.value)}
                className="mt-2 w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-white placeholder:text-neutral-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          ))}
          <ImageUploader onUploaded={addItem} multiple className="aspect-square" />
        </div>
      </div>

      {(userError || error) && (
        <div className="space-y-2">
          {userError && <ErrorMessage message={userError} />}
          {error && <ErrorMessage message={error} />}
          {userError && (
            <Button variant="secondary" onClick={retryUser}>
              Retry Identity Setup
            </Button>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={save}
          disabled={saving || userLoading || !userId || !name.trim() || items.length === 0}
        >
          {saving ? "Saving..." : templateId ? "Save Changes" : "Create Template"}
        </Button>
        <Button variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
