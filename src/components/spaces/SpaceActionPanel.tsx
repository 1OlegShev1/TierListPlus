"use client";

import { useEffect, useState } from "react";
import { CreateSpaceForm } from "@/components/spaces/CreateSpaceForm";
import { JoinSpaceByCodeForm } from "@/components/spaces/JoinSpaceByCodeForm";
import { ChevronDownIcon } from "@/components/ui/icons";

export function SpaceActionPanel({
  defaultOpen = false,
  defaultJoinCode = "",
  defaultExpectedSpaceId = "",
}: {
  defaultOpen?: boolean;
  defaultJoinCode?: string;
  defaultExpectedSpaceId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
    }
  }, [defaultOpen]);

  return (
    <section
      id="space-actions"
      className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-soft-contrast)] p-4 transition-colors hover:border-[var(--border-default)] hover:bg-[var(--bg-surface)] sm:p-5"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        aria-expanded={open}
        aria-controls="space-actions-content"
      >
        <div>
          <p className="text-base font-semibold text-[var(--fg-primary)]">Create or Join</p>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Secondary actions for starting a new space or joining a private one.
          </p>
        </div>
        <span aria-hidden="true" className="ml-4 inline-flex shrink-0 items-center justify-center">
          <ChevronDownIcon
            className={`h-7 w-7 text-[var(--fg-muted)] transition-all group-hover:text-[var(--fg-primary)] ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {open ? (
        <div id="space-actions-content" className="mt-4 grid gap-4 lg:grid-cols-2">
          <CreateSpaceForm />
          <JoinSpaceByCodeForm
            initialCode={defaultJoinCode}
            initialExpectedSpaceId={defaultExpectedSpaceId}
          />
        </div>
      ) : null}
    </section>
  );
}
