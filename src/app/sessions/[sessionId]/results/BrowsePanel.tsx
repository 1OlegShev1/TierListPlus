"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BrowseParticipantRow } from "./resultsViewModel";

export function BrowsePanel({
  title,
  isOpen,
  onToggleOpen,
  searchQuery,
  onSearchChange,
  onClearSearch,
  stopComparingHref,
  clearSelectionHref,
  compareWithEveryoneHref,
  listHeightClass,
  rows,
  onScrollToResults,
}: {
  title: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  stopComparingHref: string | null;
  clearSelectionHref: string | null;
  compareWithEveryoneHref: string | null;
  listHeightClass: string;
  rows: BrowseParticipantRow[];
  onScrollToResults: () => void;
}) {
  const router = useRouter();

  return (
    <div className="mb-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-soft-contrast)]">
      <div className="border-b border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--bg-surface)]"
        >
          <h2 className="text-lg font-semibold text-[var(--fg-primary)]">{title}</h2>
          {isOpen ? (
            <ChevronUp
              className="h-4 w-4 flex-shrink-0 text-[var(--fg-muted)]"
              aria-hidden="true"
            />
          ) : (
            <ChevronDown
              className="h-4 w-4 flex-shrink-0 text-[var(--fg-muted)]"
              aria-hidden="true"
            />
          )}
        </button>
      </div>

      {isOpen && (
        <div className="px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search people"
                className="w-full bg-transparent text-sm text-[var(--fg-primary)] outline-none placeholder:text-[var(--fg-subtle)]"
                aria-label="Search people"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--fg-primary)]"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {stopComparingHref && (
              <Link
                href={stopComparingHref}
                replace
                scroll={false}
                className="inline-flex items-center justify-center rounded-full border border-[var(--border-default)] px-3 py-2 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
              >
                Stop comparing
              </Link>
            )}
            {compareWithEveryoneHref && (
              <Link
                href={compareWithEveryoneHref}
                replace
                scroll={false}
                className="inline-flex items-center justify-center rounded-full border border-[var(--border-default)] px-3 py-2 text-sm font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
              >
                Compare with Everyone
              </Link>
            )}
          </div>

          <div className={`mt-4 space-y-2 overflow-y-auto pr-1 ${listHeightClass}`}>
            {rows.length > 0 ? (
              rows.map((row) => (
                <div
                  key={row.id}
                  data-testid={`browse-row-${row.id}`}
                  className={`relative flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-3 transition-colors ${
                    row.isFocused
                      ? "border-[var(--accent-primary)]/70 bg-[var(--accent-primary)]/10"
                      : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-default)]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const href =
                        row.isSelected && clearSelectionHref ? clearSelectionHref : row.selectHref;
                      router.replace(href, { scroll: false });
                    }}
                    data-testid={`browse-row-hitbox-${row.id}`}
                    aria-label={
                      row.isSelected ? `Deselect ${row.nickname}` : `Select ${row.nickname}`
                    }
                    className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  />

                  <div className="pointer-events-none min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--fg-primary)]">
                      <span className="truncate">{row.nickname}</span>
                      {row.isCurrentParticipant && (
                        <span className="rounded-full border border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--accent-primary-hover)]">
                          You
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="relative z-20 flex items-center gap-2">
                    {row.isSelected ? (
                      <button
                        type="button"
                        onClick={onScrollToResults}
                        className="rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
                      >
                        View
                      </button>
                    ) : (
                      <Link
                        href={row.viewHref}
                        replace
                        className="rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
                      >
                        View
                      </Link>
                    )}
                    {row.clearCompareHref && (
                      <Link
                        href={row.clearCompareHref}
                        replace
                        className="rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
                      >
                        Clear compare
                      </Link>
                    )}
                    {row.compareHref && !row.isCompared && (
                      <Link
                        href={row.compareHref}
                        replace
                        scroll={false}
                        className="rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
                      >
                        Compare
                      </Link>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-sm text-[var(--fg-muted)]">
                No one matches that search.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
