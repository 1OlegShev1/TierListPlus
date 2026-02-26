"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_TIER_CONFIG, TIER_COLORS, type TierConfig } from "@/lib/constants";

interface Template {
  id: string;
  name: string;
  _count: { items: number };
}

export function NewSessionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedTemplateId = searchParams.get("templateId");

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState(preselectedTemplateId ?? "");
  const [name, setName] = useState("");
  const [tierConfig, setTierConfig] = useState<TierConfig[]>(DEFAULT_TIER_CONFIG);
  const [bracketEnabled, setBracketEnabled] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then(setTemplates);
  }, []);

  const addTier = () => {
    const nextOrder = tierConfig.length;
    const color = TIER_COLORS[nextOrder % TIER_COLORS.length];
    setTierConfig([
      ...tierConfig,
      {
        key: `T${nextOrder}`,
        label: `Tier ${nextOrder + 1}`,
        color,
        sortOrder: nextOrder,
      },
    ]);
  };

  const removeTier = (index: number) => {
    if (tierConfig.length <= 2) return;
    setTierConfig(tierConfig.filter((_, i) => i !== index).map((t, i) => ({ ...t, sortOrder: i })));
  };

  const updateTier = (index: number, updates: Partial<TierConfig>) => {
    setTierConfig(
      tierConfig.map((t, i) => (i === index ? { ...t, ...updates } : t))
    );
  };

  const [error, setError] = useState("");

  const create = async () => {
    if (!templateId || !name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          name,
          tierConfig: tierConfig.map((t) => ({
            ...t,
            key: t.label.replace(/\s+/g, "_") || t.key,
          })),
          bracketEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
        return;
      }
      router.push(`/sessions/${data.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Start a Session</h1>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-400">
            Template
          </label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="">Select a template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t._count.items} items)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-400">
            Session Name
          </label>
          <input
            type="text"
            placeholder="e.g., Friday Rankings"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-white placeholder:text-neutral-500 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-400">
            Tier Rows
          </label>
          <div className="space-y-2">
            {tierConfig.map((tier, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="color"
                  value={tier.color}
                  onChange={(e) => updateTier(index, { color: e.target.value })}
                  className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
                />
                <input
                  type="text"
                  value={tier.label}
                  onChange={(e) =>
                    updateTier(index, { label: e.target.value })
                  }
                  className="flex-1 rounded border border-neutral-700 bg-neutral-800 px-3 py-1 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
                <button
                  onClick={() => removeTier(index)}
                  disabled={tierConfig.length <= 2}
                  className="text-sm text-neutral-500 hover:text-red-400 disabled:opacity-30"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addTier}
            className="mt-2 text-sm text-amber-400 hover:text-amber-300"
          >
            + Add tier
          </button>
        </div>

        <label className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <input
            type="checkbox"
            checked={bracketEnabled}
            onChange={(e) => setBracketEnabled(e.target.checked)}
            className="h-4 w-4 accent-amber-500"
          />
          <div>
            <p className="font-medium">Enable bracket voting</p>
            <p className="text-sm text-neutral-500">
              1v1 matchups before tier ranking to reduce bias
            </p>
          </div>
        </label>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={create}
            disabled={creating || !templateId || !name.trim()}
            className="rounded-lg bg-amber-500 px-6 py-2 font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Session"}
          </button>
          <button
            onClick={() => router.back()}
            className="rounded-lg border border-neutral-700 px-6 py-2 text-neutral-300 transition-colors hover:bg-neutral-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
