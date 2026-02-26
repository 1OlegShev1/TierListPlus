"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from "@/components/ui/icons";
import { apiPatch, getErrorMessage } from "@/lib/api-client";
import { deriveTierKeys, TIER_COLORS } from "@/lib/constants";
import type { TierConfig } from "@/types";

interface TierConfigEditorProps {
  /** When provided, the editor shows a Save button and PATCHes the session. */
  sessionId?: string;
  initialConfig: TierConfig[];
  /** Called after a successful save (connected mode). */
  onSaved?: (config: TierConfig[]) => void;
  /** Called on every change (controlled mode, when no sessionId). */
  onChange?: (config: TierConfig[]) => void;
}

export function TierConfigEditor({
  sessionId,
  initialConfig,
  onSaved,
  onChange,
}: TierConfigEditorProps) {
  const [tiers, setTiers] = useState<TierConfig[]>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFirstRender = useRef(true);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onChangeRef.current?.(tiers);
  }, [tiers]);

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
      {
        key: `T${nextOrder}`,
        label: `Tier ${nextOrder + 1}`,
        color: nextColor,
        sortOrder: nextOrder,
      },
    ]);
  };

  const removeTier = (index: number) => {
    if (tiers.length <= 2) return;
    setTiers((prev) => prev.filter((_, i) => i !== index).map((t, i) => ({ ...t, sortOrder: i })));
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

    const configToSave = deriveTierKeys(tiers);

    try {
      await apiPatch(`/api/sessions/${sessionId}`, { tierConfig: configToSave });
      onSaved?.(configToSave);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {tiers.map((tier, index) => (
          <div key={tier.key} className="flex items-center gap-2">
            {/* Color picker */}
            <input
              type="color"
              value={tier.color}
              onChange={(e) => updateTier(index, "color", e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent"
              title="Tier color"
              aria-label={`Color for ${tier.label}`}
            />

            {/* Label input */}
            <Input
              type="text"
              value={tier.label}
              onChange={(e) => updateTier(index, "label", e.target.value)}
              maxLength={20}
              className="w-32 bg-neutral-800 px-2 py-1 text-sm"
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
              aria-label={`Move ${tier.label} up`}
            >
              <ChevronUpIcon />
            </button>
            <button
              onClick={() => moveTier(index, 1)}
              disabled={index === tiers.length - 1}
              className="text-neutral-500 hover:text-neutral-300 disabled:opacity-30"
              title="Move down"
              aria-label={`Move ${tier.label} down`}
            >
              <ChevronDownIcon />
            </button>

            {/* Remove button */}
            <button
              onClick={() => removeTier(index)}
              disabled={tiers.length <= 2}
              className="text-neutral-500 hover:text-red-400 disabled:opacity-30"
              title="Remove tier"
              aria-label={`Remove ${tier.label}`}
            >
              <CloseIcon />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={addTier} className="px-3 py-1 text-xs">
          + Add Row
        </Button>
        {sessionId && (
          <Button onClick={handleSave} disabled={saving} className="px-4 py-1 text-xs">
            {saving ? "Saving..." : "Save Config"}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
