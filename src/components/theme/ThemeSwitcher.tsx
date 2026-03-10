"use client";

import { Laptop2, Moon, Sun } from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";
import {
  applyThemePreference,
  isThemePreference,
  notifyThemePreferenceChanged,
  persistThemePreference,
  resolveThemePreference,
  THEME_PREFERENCE_CHANGE_EVENT,
  THEME_PREFERENCE_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme-preference";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}> = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Laptop2 },
];

function getNextThemePreference(current: ThemePreference): ThemePreference {
  const index = THEME_OPTIONS.findIndex((option) => option.value === current);
  if (index < 0) return "dark";
  return THEME_OPTIONS[(index + 1) % THEME_OPTIONS.length]?.value ?? "dark";
}

export function ThemeSwitcher({
  compact = false,
  variant = "segmented",
  className,
}: {
  compact?: boolean;
  variant?: "segmented" | "cycle";
  className?: string;
}) {
  const [preference, setPreference] = useState<ThemePreference>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const resolved = resolveThemePreference("dark");
    setPreference(resolved);
    applyThemePreference(resolved);
    setReady(true);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_PREFERENCE_STORAGE_KEY) return;
      if (!isThemePreference(event.newValue)) return;
      setPreference(event.newValue);
      applyThemePreference(event.newValue);
    };
    const onPreferenceChange = (event: Event) => {
      const next = (event as CustomEvent<ThemePreference>).detail;
      if (!isThemePreference(next)) return;
      setPreference(next);
      applyThemePreference(next);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_PREFERENCE_CHANGE_EVENT, onPreferenceChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_PREFERENCE_CHANGE_EVENT, onPreferenceChange);
    };
  }, []);

  const updatePreference = (next: ThemePreference) => {
    setPreference(next);
    applyThemePreference(next);
    persistThemePreference(next);
    notifyThemePreferenceChanged(next);
  };

  if (variant === "cycle") {
    const activePreference = preference;
    const activeOption =
      THEME_OPTIONS.find((option) => option.value === activePreference) ?? THEME_OPTIONS[0];
    const nextPreference = getNextThemePreference(activePreference);
    const nextOption =
      THEME_OPTIONS.find((option) => option.value === nextPreference) ?? THEME_OPTIONS[0];
    const ActiveIcon = activeOption.icon;

    return (
      <button
        type="button"
        onClick={() => updatePreference(nextPreference)}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
          className,
        )}
        aria-label={`Theme ${activeOption.label}. Switch to ${nextOption.label}`}
        title={`Theme: ${activeOption.label} (next: ${nextOption.label})`}
      >
        <ActiveIcon className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  return (
    <fieldset
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-1",
        className,
      )}
      data-ready={ready ? "true" : "false"}
    >
      <legend className="sr-only">Theme mode</legend>
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = preference === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => updatePreference(option.value)}
            className={cn(
              "inline-flex h-8 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              compact ? "w-8" : "gap-1.5",
              active
                ? "border-[var(--border-strong)] bg-[var(--bg-surface-hover)] text-[var(--fg-primary)]"
                : "border-transparent text-[var(--fg-muted)] hover:border-[var(--border-default)] hover:text-[var(--fg-primary)]",
            )}
            aria-label={`Switch theme to ${option.label}`}
            aria-pressed={active}
            title={option.label}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {!compact ? <span>{option.label}</span> : null}
          </button>
        );
      })}
    </fieldset>
  );
}
