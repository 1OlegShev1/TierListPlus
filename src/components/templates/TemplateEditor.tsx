"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUploader } from "@/components/shared/ImageUploader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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

    try {
      let id = templateId;

      if (!id) {
        // Create template
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        });
        const template = await res.json();
        id = template.id;
      } else {
        // Update template
        await fetch(`/api/templates/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        });
      }

      // Save items (for simplicity, delete existing and re-add)
      // For existing templates, we'd ideally diff, but batch create is simpler for MVP
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

      // Add new items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.id && existingIds.has(item.id)) {
          // Update existing
          await fetch(`/api/templates/${id}/items/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: item.label,
              sortOrder: i,
            }),
          });
        } else {
          // Create new
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
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-amber-500 focus:outline-none"
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
