"use client";

import { useState } from "react";
import { TIER_COLORS, type TierConfig } from "@/lib/constants";

interface TierConfigEditorProps {
  sessionId: string;
  initialConfig: TierConfig[];
  onSaved: (config: TierConfig[]) => void;
}

export function TierConfigEditor({
  sessionId,
  initialConfig,
  onSaved,
}: TierConfigEditorProps) {
  const [tiers, setTiers] = useState<TierConfig[]>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateTier = (index: number, field: keyof TierConfig, value: string | number) => {
    setTiers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addTier = () => {
    const nextColor = TIER_COLORS[tiers.length % TIER_COLORS.length];
    const nextOrder = tiers.length;
    setTiers((prev) => [
      ...prev,
      { key: `T${nextOrder}`, label: `Tier ${nextOrder + 1}`, color: nextColor, sortOrder: nextOrder },
    ]);
  };

  const removeTier = (index: number) => {
    if (tiers.length <= 2) return;
    setTiers((prev) =>
      prev.filter((_, i) => i !== index).map((t, i) => ({ ...t, sortOrder: i }))
    );
  };

  const moveTier = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= tiers.length) return;
    setTiers((prev) => {
      const updated = [...prev];
      [updated[index], updated[target]] = [updated[target], updated[index]];
      return updated.map((t, i) => ({ ...t, sortOrder: i }));
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    // Derive keys from labels at save time
    const configToSave = tiers.map((t, i) => ({
      key: t.label.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || `T${i}`,
      label: t.label,
      color: t.color,
      sortOrder: i,
    }));

    // Ensure unique keys
    const seen = new Set<string>();
    for (const tier of configToSave) {
      let k = tier.key;
      let n = 1;
      while (seen.has(k)) {
        k = `${tier.key}${n++}`;
      }
      tier.key = k;
      seen.add(k);
    }

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierConfig: configToSave }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      onSaved(configToSave);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {tiers.map((tier, index) => (
          <div key={index} className="flex items-center gap-2">
            {/* Color picker */}
            <input
              type="color"
              value={tier.color}
              onChange={(e) => updateTier(index, "color", e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
              title="Tier color"
            />

            {/* Label input */}
            <input
              type="text"
              value={tier.label}
              onChange={(e) => updateTier(index, "label", e.target.value)}
              maxLength={20}
              className="w-32 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none"
              placeholder="Tier label"
            />

            {/* Preview chip */}
            <span
              className="rounded px-2 py-0.5 text-xs font-bold"
              style={{ backgroundColor: tier.color, color: "#000" }}
            >
              {tier.label || "?"}
            </span>

            {/* Move buttons */}
            <button
              onClick={() => moveTier(index, -1)}
              disabled={index === 0}
              className="text-neutral-500 hover:text-neutral-300 disabled:opacity-30"
              title="Move up"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={() => moveTier(index, 1)}
              disabled={index === tiers.length - 1}
              className="text-neutral-500 hover:text-neutral-300 disabled:opacity-30"
              title="Move down"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Remove button */}
            <button
              onClick={() => removeTier(index)}
              disabled={tiers.length <= 2}
              className="text-neutral-500 hover:text-red-400 disabled:opacity-30"
              title="Remove tier"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={addTier}
          className="rounded border border-neutral-700 px-3 py-1 text-xs text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
        >
          + Add Row
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-amber-500 px-4 py-1 text-xs font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Config"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
