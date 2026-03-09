"use client";

import type { RefObject } from "react";
import type { ConsensusItem, ConsensusTier } from "@/lib/consensus";
import { CompareColumn, ResultsTierGrid } from "./ResultsTierGrid";
import { buildCompareDifferenceStates } from "./resultsCompareDiff";

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
  highlightDifferences,
  onToggleHighlightDifferences,
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
  highlightDifferences: boolean;
  onToggleHighlightDifferences: () => void;
  onCompareLeftToggle: (item: ConsensusItem) => void;
  onCompareRightToggle: (item: ConsensusItem) => void;
  onItemToggle: (item: ConsensusItem) => void;
  onOpenSource: (item: ConsensusItem) => void;
}) {
  const diffStates =
    highlightDifferences && hasCompareSelection && compareRightTiers
      ? buildCompareDifferenceStates({
          leftTiers: initialParticipantTiers,
          rightTiers: compareRightTiers,
        })
      : null;

  return (
    <div id="results" ref={resultsRef} className="space-y-6">
      {hasCompareSelection && compareRightTiers ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onToggleHighlightDifferences}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                highlightDifferences
                  ? "border-amber-500/80 bg-amber-500/15 text-amber-200"
                  : "border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-neutral-100"
              }`}
            >
              Highlight differences {highlightDifferences ? "On" : "Off"}
            </button>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <CompareColumn
              title={initialParticipantName ?? selectedNickname ?? "Selected person"}
              tiers={initialParticipantTiers}
              selectedItem={compareLeftSelectedItem}
              onItemToggle={onCompareLeftToggle}
              onOpenSource={onOpenSource}
              compact
              compareDifferenceStateByItemId={highlightDifferences ? (diffStates?.left ?? {}) : {}}
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
              compareDifferenceStateByItemId={highlightDifferences ? (diffStates?.right ?? {}) : {}}
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
