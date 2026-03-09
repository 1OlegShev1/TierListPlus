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
    <div className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-950/40">
      <div className="border-b border-neutral-800">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-neutral-900/50"
        >
          <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 flex-shrink-0 text-neutral-400" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 flex-shrink-0 text-neutral-400" aria-hidden="true" />
          )}
        </button>
      </div>

      {isOpen && (
        <div className="px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950/80 px-3 py-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search people"
                className="w-full bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
                aria-label="Search people"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
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
                className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:text-neutral-50"
              >
                Stop comparing
              </Link>
            )}
            {compareWithEveryoneHref && (
              <Link
                href={compareWithEveryoneHref}
                replace
                scroll={false}
                className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:text-neutral-50"
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
                      ? "border-amber-500/70 bg-amber-500/10"
                      : "border-neutral-800 bg-neutral-950/70 hover:border-neutral-700"
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
                    className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                  />

                  <div className="relative z-10 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-100">
                      <span className="truncate">{row.nickname}</span>
                      {row.isCurrentParticipant && (
                        <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
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
                        className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:text-neutral-50"
                      >
                        View
                      </button>
                    ) : (
                      <Link
                        href={row.viewHref}
                        replace
                        className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:text-neutral-50"
                      >
                        View
                      </Link>
                    )}
                    {row.clearCompareHref && (
                      <Link
                        href={row.clearCompareHref}
                        replace
                        className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:text-neutral-50"
                      >
                        Clear compare
                      </Link>
                    )}
                    {row.compareHref && !row.isCompared && (
                      <Link
                        href={row.compareHref}
                        replace
                        scroll={false}
                        className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:text-neutral-50"
                      >
                        Compare
                      </Link>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-neutral-800 px-4 py-6 text-center text-sm text-neutral-400">
                No one matches that search.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
