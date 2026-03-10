"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { useUser } from "@/hooks/useUser";
import { apiPost, getErrorMessage } from "@/lib/api-client";

export function CreateSpaceForm() {
  const router = useRouter();
  const { userId, isLoading: userLoading } = useUser();
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "OPEN">("PRIVATE");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = !!userId && !userLoading && !creating && name.trim().length > 0;

  const createSpace = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    try {
      const created = await apiPost<{ id: string }>("/api/spaces", {
        name: name.trim(),
        visibility,
      });
      router.push(`/spaces/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create this space"));
      setCreating(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-5">
      <h2 className="text-base font-semibold text-[var(--fg-primary)]">Create a Space</h2>
      <p className="mt-1 text-sm text-[var(--fg-subtle)]">
        Private for friend groups, open for communities.
      </p>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
        <Input
          className="h-11"
          placeholder="e.g., Movie Night Crew"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <fieldset className="relative inline-grid h-11 min-w-[10.5rem] grid-cols-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-soft-contrast)] p-1">
          <legend className="sr-only">Space visibility</legend>
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-sm transition-transform duration-200 ${
              visibility === "OPEN" ? "translate-x-full" : "translate-x-0"
            }`}
          />
          <label
            className={`relative z-10 flex cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium transition-colors ${
              visibility === "PRIVATE"
                ? "text-[var(--fg-primary)]"
                : "text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]"
            }`}
          >
            <input
              type="radio"
              name="space-visibility"
              value="PRIVATE"
              checked={visibility === "PRIVATE"}
              onChange={() => setVisibility("PRIVATE")}
              className="sr-only"
            />
            Private
          </label>
          <label
            className={`relative z-10 flex cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium transition-colors ${
              visibility === "OPEN"
                ? "text-[var(--fg-primary)]"
                : "text-[var(--fg-muted)] hover:text-[var(--fg-secondary)]"
            }`}
          >
            <input
              type="radio"
              name="space-visibility"
              value="OPEN"
              checked={visibility === "OPEN"}
              onChange={() => setVisibility("OPEN")}
              className="sr-only"
            />
            Open
          </label>
        </fieldset>
        <Button onClick={createSpace} disabled={!canCreate} className="h-11 !px-5 !py-0 !text-sm">
          {creating ? "Creating..." : "Create"}
        </Button>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorMessage message={error} />
        </div>
      )}
    </div>
  );
}
