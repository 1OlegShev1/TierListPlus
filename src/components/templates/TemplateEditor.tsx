"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

interface TemplateItem {
  id?: string;
  label: string;
  imageUrl: string;
  sortOrder: number;
}

interface TemplateEditorProps {
  templateId?: string;
  initialName?: string;
  initialDescription?: string;
  initialItems?: TemplateItem[];
}

export function TemplateEditor({
  templateId,
  initialName = "",
  initialDescription = "",
  initialItems = [],
}: TemplateEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [items, setItems] = useState<TemplateItem[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addItem = (imageUrl: string) => {
    setItems((prev) => [
      ...prev,
      { label: "", imageUrl, sortOrder: prev.length },
    ]);
  };

  const updateItemLabel = (index: number, label: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, label } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    try {
      let id = templateId;

      if (!id) {
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(typeof data.error === "string" ? data.error : "Failed to create template");
          return;
        }
        const template = await res.json();
        id = template.id;
      } else {
        const res = await fetch(`/api/templates/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(typeof data.error === "string" ? data.error : "Failed to update template");
          return;
        }
      }

      const existingItems = initialItems.filter((i) => i.id);
      const existingIds = new Set(existingItems.map((i) => i.id));

      // Delete removed items
      for (const existing of initialItems) {
        if (existing.id && !items.find((i) => i.id === existing.id)) {
          await fetch(`/api/templates/${id}/items/${existing.id}`, {
            method: "DELETE",
          });
        }
      }

      // Create or update items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.id && existingIds.has(item.id)) {
          await fetch(`/api/templates/${id}/items/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: item.label, sortOrder: i }),
          });
        } else {
          await fetch(`/api/templates/${id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: item.label,
              imageUrl: item.imageUrl,
              sortOrder: i,
            }),
          });
        }
      }

      router.push(`/templates/${id}`);
    } catch {
      setError("Network error. Please try again.");
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
        <h3 className="mb-3 text-sm font-medium text-neutral-400">
          Items ({items.length})
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item, index) => (
            <div
              key={item.id ?? `new-${index}`}
              className="group relative rounded-lg border border-neutral-800 bg-neutral-900 p-2"
            >
              <button
                onClick={() => removeItem(index)}
                className="absolute -right-2 -top-2 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white group-hover:flex"
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
          <ImageUploader onUploaded={addItem} className="aspect-square" />
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="flex gap-3">
        <Button onClick={save} disabled={saving || !name.trim() || items.length === 0}>
          {saving ? "Saving..." : templateId ? "Save Changes" : "Create Template"}
        </Button>
        <Button variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
