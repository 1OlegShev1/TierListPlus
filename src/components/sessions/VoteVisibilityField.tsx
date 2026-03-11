"use client";

import { useId } from "react";

interface VoteVisibilityFieldProps {
  isPrivate: boolean;
  disabled?: boolean;
  helperText: string;
  extraNote?: string;
  onChange: (isPrivate: boolean) => void;
}

export function VoteVisibilityField({
  isPrivate,
  disabled = false,
  helperText,
  extraNote,
  onChange,
}: VoteVisibilityFieldProps) {
  const visibilityFieldName = useId();

  return (
    <div
      className={`rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 ${
        disabled ? "opacity-80" : ""
      }`}
    >
      <div>
        <p className="font-medium">Show in public Votes list</p>
        <div className="mt-3">
          <fieldset
            className={`relative inline-grid h-11 min-w-[11rem] grid-cols-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-soft-contrast)] p-1 ${
              disabled ? "cursor-not-allowed" : ""
            }`}
          >
            <legend className="sr-only">Vote visibility</legend>
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-sm transition-transform duration-200 ${
                isPrivate ? "translate-x-0" : "translate-x-full"
              }`}
            />
            <label
              className={`relative z-10 flex items-center justify-center rounded-md px-3 text-sm font-medium transition-colors ${
                disabled ? "cursor-not-allowed" : "cursor-pointer"
              } ${isPrivate ? "text-[var(--fg-primary)]" : "text-[var(--fg-muted)]"}`}
            >
              <input
                type="radio"
                name={visibilityFieldName}
                value="PRIVATE"
                checked={isPrivate}
                onChange={() => onChange(true)}
                disabled={disabled}
                className="sr-only"
              />
              Private
            </label>
            <label
              className={`relative z-10 flex items-center justify-center rounded-md px-3 text-sm font-medium transition-colors ${
                disabled ? "cursor-not-allowed" : "cursor-pointer"
              } ${!isPrivate ? "text-[var(--fg-primary)]" : "text-[var(--fg-muted)]"}`}
            >
              <input
                type="radio"
                name={visibilityFieldName}
                value="PUBLIC"
                checked={!isPrivate}
                onChange={() => onChange(false)}
                disabled={disabled}
                className="sr-only"
              />
              Public
            </label>
          </fieldset>
        </div>
        <p className="mt-3 text-sm text-[var(--fg-subtle)]">{helperText}</p>
        {extraNote ? <p className="text-xs text-[var(--fg-subtle)]">{extraNote}</p> : null}
      </div>
    </div>
  );
}
