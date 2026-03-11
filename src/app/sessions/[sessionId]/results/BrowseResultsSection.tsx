"use client";

import { type RefObject, useId } from "react";
import type { ConsensusItem, ConsensusTier } from "@/lib/consensus";
import { CompareColumn, ResultsTierGrid } from "./ResultsTierGrid";
import { buildCompareDifferenceStates } from "./resultsCompareDiff";

export type CompareHighlightMode = "off" | "differences" | "similarities";

function flipDiffStates(
  states: Record<string, "none" | "same" | "changed">,
): Record<string, "none" | "same" | "changed"> {
  const flipped: Record<string, "none" | "same" | "changed"> = {};
  for (const [id, state] of Object.entries(states)) {
    flipped[id] = state === "same" ? "changed" : state === "changed" ? "same" : state;
  }
  return flipped;
}

export function BrowseResultsSection({
  resultsRef,
  hasCompareSelection,
  hasEveryoneCompareSelection,
  initialParticipantName,
  selectedNickname,
  initialParticipantTiers,
  initialCompareParticipantName,
  comparedNickname,
  compareRightTiers,
  compareLeftSelectedItem,
  compareRightSelectedItem,
  selectedItem,
  compareHighlightMode,
  onChangeCompareHighlightMode,
  onCompareLeftToggle,
  onCompareRightToggle,
  onItemToggle,
  onOpenSource,
}: {
  resultsRef: RefObject<HTMLDivElement | null>;
  hasCompareSelection: boolean;
  hasEveryoneCompareSelection: boolean;
  initialParticipantName: string | null;
  selectedNickname: string | null;
  initialParticipantTiers: ConsensusTier[];
  initialCompareParticipantName: string | null;
  comparedNickname: string | null;
  compareRightTiers: ConsensusTier[] | null;
  compareLeftSelectedItem: ConsensusItem | null;
  compareRightSelectedItem: ConsensusItem | null;
  selectedItem: ConsensusItem | null;
  compareHighlightMode: CompareHighlightMode;
  onChangeCompareHighlightMode: (mode: CompareHighlightMode) => void;
  onCompareLeftToggle: (item: ConsensusItem) => void;
  onCompareRightToggle: (item: ConsensusItem) => void;
  onItemToggle: (item: ConsensusItem) => void;
  onOpenSource: (item: ConsensusItem) => void;
}) {
  const compareHighlightModeHintId = useId();
  const isHighlightActive = compareHighlightMode !== "off";
  const rawDiffStates =
    isHighlightActive && hasCompareSelection && compareRightTiers
      ? buildCompareDifferenceStates({
          leftTiers: initialParticipantTiers,
          rightTiers: compareRightTiers,
        })
      : null;
  const diffStates =
    rawDiffStates && compareHighlightMode === "similarities"
      ? { left: flipDiffStates(rawDiffStates.left), right: flipDiffStates(rawDiffStates.right) }
      : rawDiffStates;

  return (
    <div id="results" ref={resultsRef} className="space-y-6">
      {hasCompareSelection && compareRightTiers ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <fieldset
              aria-describedby={compareHighlightModeHintId}
              className="inline-flex overflow-hidden rounded-full border border-[var(--border-default)]"
            >
              <legend className="sr-only">Compare highlight mode</legend>
              {(
                [
                  { value: "differences", label: "Differences" },
                  { value: "similarities", label: "Similarities" },
                ] as const
              ).map((option) => {
                const active = compareHighlightMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChangeCompareHighlightMode(active ? "off" : option.value)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary-hover)]"
                        : "text-[var(--fg-secondary)] hover:bg-[var(--bg-soft-contrast)] hover:text-[var(--fg-primary)]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </fieldset>
            <span id={compareHighlightModeHintId} className="sr-only">
              Select Differences or Similarities. Press the active option again to turn highlighting
              off.
            </span>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <CompareColumn
              title={initialParticipantName ?? selectedNickname ?? "Selected person"}
              tiers={initialParticipantTiers}
              selectedItem={compareLeftSelectedItem}
              onItemToggle={onCompareLeftToggle}
              onOpenSource={onOpenSource}
              compact
              compareDifferenceStateByItemId={isHighlightActive ? (diffStates?.left ?? {}) : {}}
            />
            <CompareColumn
              title={
                hasEveryoneCompareSelection
                  ? "Everyone"
                  : (initialCompareParticipantName ?? comparedNickname ?? "Compared person")
              }
              tiers={compareRightTiers}
              selectedItem={compareRightSelectedItem}
              onItemToggle={onCompareRightToggle}
              onOpenSource={onOpenSource}
              compact
              compareDifferenceStateByItemId={isHighlightActive ? (diffStates?.right ?? {}) : {}}
            />
          </div>
        </div>
      ) : (
        <ResultsTierGrid
          tiers={initialParticipantTiers}
          individualView
          selectedItem={selectedItem}
          onItemToggle={onItemToggle}
          onItemClick={onItemToggle}
          onItemTouchStart={() => undefined}
          onItemTouchEnd={(item) => onItemToggle(item)}
          onItemTouchCancel={() => undefined}
          onOpenSource={onOpenSource}
          compact
        />
      )}
    </div>
  );
}
