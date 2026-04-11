"use client";

import { Input } from "@/components/ui/Input";

interface SourceIntervalFieldsProps {
  draftStartSec: string;
  draftEndSec: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  saving: boolean;
  resolvedDurationLabel: string | null;
}

export function SourceIntervalFields({
  draftStartSec,
  draftEndSec,
  onStartChange,
  onEndChange,
  saving,
  resolvedDurationLabel,
}: SourceIntervalFieldsProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--fg-secondary)]">Start time</span>
          <Input
            type="text"
            inputMode="text"
            placeholder="e.g. 1:30"
            value={draftStartSec}
            onChange={(event) => onStartChange(event.target.value)}
            disabled={saving}
            className="w-full"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--fg-secondary)]">End time</span>
          <Input
            type="text"
            inputMode="text"
            placeholder="e.g. 2:15"
            value={draftEndSec}
            onChange={(event) => onEndChange(event.target.value)}
            disabled={saving}
            className="w-full"
          />
        </label>
      </div>
      <p className="text-xs text-[var(--fg-subtle)]">
        Examples: 90, 1:30, 1:02:30.{" "}
        {resolvedDurationLabel
          ? `Clip length: ${resolvedDurationLabel}.`
          : "If end exceeds clip length, playback ends naturally."}
      </p>
    </div>
  );
}
