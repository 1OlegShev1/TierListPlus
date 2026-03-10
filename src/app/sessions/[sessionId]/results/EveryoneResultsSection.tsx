"use client";

import { Link2 } from "lucide-react";
import type { RefObject, TouchEvent } from "react";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import type { ConsensusItem, ConsensusTier } from "@/lib/consensus";
import { ResultsTierGrid } from "./ResultsTierGrid";

const MAX_TIER_TOOLTIP_NAMES = 4;

function formatTierVoterPreview(names: string[]): string {
  const visibleNames = names.slice(0, MAX_TIER_TOOLTIP_NAMES);
  const hiddenCount = names.length - visibleNames.length;
  const preview = visibleNames.join(", ");

  if (hiddenCount <= 0) return preview;
  return `${preview}, +${hiddenCount} more`;
}

export function EveryoneResultsSection({
  resultsRef,
  consensusTiers,
  selectedItem,
  onItemToggle,
  onItemClick,
  onItemTouchStart,
  onItemTouchEnd,
  onItemTouchCancel,
  detailsItem,
  detailsOpen,
  detailsPanelRef,
  isTouchInput,
  onOpenSource,
}: {
  resultsRef: RefObject<HTMLDivElement | null>;
  consensusTiers: ConsensusTier[];
  selectedItem: ConsensusItem | null;
  onItemToggle: (item: ConsensusItem) => void;
  onItemClick: (item: ConsensusItem) => void;
  onItemTouchStart: (itemId: string, event: TouchEvent<HTMLButtonElement>) => void;
  onItemTouchEnd: (item: ConsensusItem, event: TouchEvent<HTMLButtonElement>) => void;
  onItemTouchCancel: () => void;
  detailsItem: ConsensusItem | null;
  detailsOpen: boolean;
  detailsPanelRef: RefObject<HTMLDivElement | null>;
  isTouchInput: boolean;
  onOpenSource: (item: ConsensusItem) => void;
}) {
  return (
    <>
      <div id="results" ref={resultsRef}>
        <ResultsTierGrid
          tiers={consensusTiers}
          individualView={false}
          selectedItem={selectedItem}
          onItemToggle={onItemToggle}
          onItemClick={onItemClick}
          onItemTouchStart={onItemTouchStart}
          onItemTouchEnd={onItemTouchEnd}
          onItemTouchCancel={onItemTouchCancel}
          onOpenSource={onOpenSource}
        />
      </div>

      {detailsItem && (
        <div
          ref={detailsPanelRef}
          className={`mt-6 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] transition-[opacity,transform,max-height,margin] duration-200 ease-out ${
            detailsOpen
              ? "max-h-[32rem] translate-y-0 opacity-100"
              : "pointer-events-none max-h-0 -translate-y-2 opacity-0"
          }`}
        >
          <div className="border-b border-[var(--border-subtle)] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] sm:h-20 sm:w-20">
                <ItemArtwork
                  src={detailsItem.imageUrl}
                  alt={detailsItem.label}
                  className="h-full w-full"
                  presentation="ambient"
                  animate={detailsOpen}
                />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-[var(--fg-primary)]">
                  {detailsItem.label}
                </h3>
                <p className="mt-1 text-sm text-[var(--fg-muted)]">
                  Average score {detailsItem.averageScore.toFixed(2)} from {detailsItem.totalVotes}{" "}
                  vote{detailsItem.totalVotes !== 1 ? "s" : ""}
                </p>
              </div>
              {detailsItem.sourceUrl && (
                <button
                  type="button"
                  onClick={() => onOpenSource(detailsItem)}
                  className="ml-2 inline-flex items-center gap-1.5 rounded-md border border-[var(--source-control-linked-border)] bg-[var(--source-control-linked-bg)] px-2 py-1 text-xs font-medium text-[var(--source-control-linked-fg)] transition-colors hover:border-[var(--source-control-linked-border-hover)] hover:bg-[var(--source-control-linked-bg-hover)] hover:text-[var(--source-control-linked-fg-hover)] sm:ml-auto"
                >
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Source
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div>
              <h4 className="mb-3 text-sm font-medium text-[var(--fg-secondary)]">
                Placement breakdown
              </h4>
              <div className="space-y-2 px-4 py-3">
                {consensusTiers.map((tier) => {
                  const count = detailsItem.voteDistribution[tier.key] ?? 0;
                  const voterNames = detailsItem.voterNicknamesByTier[tier.key] ?? [];
                  const tooltipPreview =
                    voterNames.length > 0 ? formatTierVoterPreview(voterNames) : null;
                  const pct =
                    detailsItem.totalVotes > 0
                      ? Math.min(100, (count / detailsItem.totalVotes) * 100)
                      : 0;
                  const pctRounded = Math.round(pct);

                  return (
                    <div
                      key={tier.key}
                      className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 sm:grid-cols-[6rem_1fr_auto] md:grid-cols-[7rem_1fr_auto] md:gap-4 lg:grid-cols-[8rem_1fr_auto]"
                    >
                      <span
                        className="inline-flex h-7 w-full items-center justify-center overflow-hidden rounded px-2 py-1 text-xs font-bold"
                        style={{ backgroundColor: tier.color, color: "var(--fg-on-accent)" }}
                        title={tier.label}
                      >
                        <span className="block w-full truncate text-center leading-none">
                          {tier.label}
                        </span>
                      </span>
                      <div className="group relative">
                        <div className="relative h-3 overflow-hidden rounded-full border border-[var(--border-default)]/80 bg-[var(--bg-elevated)]">
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 opacity-30"
                            style={{
                              backgroundImage:
                                "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0, rgba(255,255,255,0.06) 6px, transparent 6px, transparent 12px)",
                            }}
                          />
                          <div
                            className="relative h-full rounded-full transition-[width] duration-500 ease-out"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: tier.color,
                              boxShadow: `0 0 0 1px ${tier.color}80 inset, 0 0 10px ${tier.color}55`,
                              minWidth: count > 0 ? "10px" : "0",
                            }}
                          />
                        </div>
                        {!isTouchInput && tooltipPreview && (
                          <div className="pointer-events-none absolute left-0 top-full z-10 mt-2 max-w-xs translate-y-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-left text-xs text-[var(--fg-secondary)] opacity-0 shadow-lg transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
                            <span className="block font-medium text-[var(--fg-primary)]">
                              {tooltipPreview}
                            </span>
                            <span className="mt-1 block text-[11px] text-[var(--fg-subtle)]">
                              {count} vote{count !== 1 ? "s" : ""} in {tier.label}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="w-16 text-right text-xs tabular-nums text-[var(--fg-subtle)]">
                        {count} · {pctRounded}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
