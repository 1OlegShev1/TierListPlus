"use client";

import type { RefObject } from "react";
import type { ConsensusItem, ConsensusTier } from "@/lib/consensus";
import { CompareColumn, ResultsTierGrid } from "./ResultsTierGrid";

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
  onCompareLeftToggle: (item: ConsensusItem) => void;
  onCompareRightToggle: (item: ConsensusItem) => void;
  onItemToggle: (item: ConsensusItem) => void;
  onOpenSource: (item: ConsensusItem) => void;
}) {
  return (
    <div id="results" ref={resultsRef} className="space-y-6">
      {hasCompareSelection && compareRightTiers ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <CompareColumn
            title={initialParticipantName ?? selectedNickname ?? "Selected person"}
            tiers={initialParticipantTiers}
            selectedItem={compareLeftSelectedItem}
            onItemToggle={onCompareLeftToggle}
            onOpenSource={onOpenSource}
            compact
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
          />
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
