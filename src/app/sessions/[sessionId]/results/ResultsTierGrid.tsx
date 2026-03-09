"use client";

import { Link2 } from "lucide-react";
import type { TouchEvent } from "react";
import { DraggableItem } from "@/components/tierlist/DraggableItem";
import { TIGHT_DRAGGABLE_ITEM_METRICS_CLASS } from "@/components/tierlist/sizing";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import type { ConsensusItem, ConsensusTier } from "@/lib/consensus";

export type ExpandedTransformOrigin = "center center" | "top center" | "bottom center";

export function getExpandedTransformOrigin(
  tierIndex: number,
  tierCount: number,
): ExpandedTransformOrigin {
  const isFirstTier = tierIndex === 0;
  const isLastTier = tierIndex === tierCount - 1;
  if (isFirstTier && isLastTier) return "center center";
  if (isFirstTier) return "top center";
  if (isLastTier) return "bottom center";
  return "center center";
}

export function ResultsTierGrid({
  tiers,
  individualView,
  selectedItem,
  onItemToggle,
  onItemClick,
  onItemTouchStart,
  onItemTouchEnd,
  onItemTouchCancel,
  onOpenSource,
  compact = false,
}: {
  tiers: ConsensusTier[];
  individualView: boolean;
  selectedItem: ConsensusItem | null;
  onItemToggle: (item: ConsensusItem) => void;
  onItemClick: (item: ConsensusItem) => void;
  onItemTouchStart: (itemId: string, event: TouchEvent<HTMLButtonElement>) => void;
  onItemTouchEnd: (item: ConsensusItem, event: TouchEvent<HTMLButtonElement>) => void;
  onItemTouchCancel: () => void;
  onOpenSource: (item: ConsensusItem) => void;
  compact?: boolean;
}) {
  const rowHeightClass = compact
    ? "min-h-[60px] sm:min-h-[68px] md:min-h-[74px] lg:min-h-[88px]"
    : "min-h-[72px] sm:min-h-[80px] md:min-h-[90px] lg:min-h-[104px]";
  const labelWidthClass = compact
    ? "w-16 px-1.5 text-xs sm:w-20 sm:px-2 sm:text-sm md:w-24 md:text-base lg:w-28 lg:text-lg"
    : "w-20 px-2 text-sm sm:w-24 sm:px-3 sm:text-base md:w-28 md:text-lg lg:w-32 lg:text-xl";
  const tierLabelTextClass = compact
    ? "text-[10px] sm:text-sm md:text-base lg:text-lg"
    : "text-[11px] sm:text-base md:text-lg lg:text-xl";
  const lanePaddingClass = compact
    ? "gap-1 p-1 sm:gap-1 sm:p-1 md:gap-1.5 md:p-1.5 lg:gap-1.5 lg:p-1.5"
    : "gap-1 p-1 sm:gap-1.5 sm:p-1.5 md:gap-2 md:p-2";
  const nonIndividualItemClass = compact
    ? "h-[52px] w-[52px] sm:h-[58px] sm:w-[58px] md:h-[64px] md:w-[64px] lg:h-[76px] lg:w-[76px]"
    : "h-[62px] w-[62px] sm:h-[70px] sm:w-[70px] md:h-[78px] md:w-[78px] lg:h-[96px] lg:w-[96px]";
  const emptyTierClass = compact
    ? "h-[52px] px-2 text-[11px] sm:h-[58px] sm:px-2 md:h-[64px] md:px-2.5 lg:h-[76px] lg:px-3 lg:text-xs"
    : "h-[60px] px-2 text-xs sm:h-[70px] sm:px-2.5 md:h-[84px] md:px-3 lg:h-[96px] lg:px-4 lg:text-sm";

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800 touch-pan-y">
      {tiers.map((tier, tierIndex) => {
        const expandedTransformOrigin = getExpandedTransformOrigin(tierIndex, tiers.length);

        return (
          <div
            key={tier.key}
            className={`flex border-b border-neutral-800 last:border-b-0 ${rowHeightClass}`}
          >
            <div
              className={`flex flex-shrink-0 items-center justify-center py-2 text-center font-bold ${labelWidthClass}`}
              style={{ backgroundColor: tier.color, color: "#000" }}
              title={tier.label}
            >
              <span
                className={`block max-w-full leading-tight line-clamp-2 break-words sm:line-clamp-none ${tierLabelTextClass}`}
              >
                {tier.label}
              </span>
            </div>
            <div className={`flex flex-1 touch-pan-y flex-wrap items-start ${lanePaddingClass}`}>
              {tier.items.map((item) =>
                individualView ? (
                  <DraggableItem
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    imageUrl={item.imageUrl}
                    sourceUrl={item.sourceUrl}
                    sourceProvider={item.sourceProvider}
                    isExpanded={selectedItem?.id === item.id}
                    onExpand={() => onItemToggle(item)}
                    onCollapse={() => onItemToggle(item)}
                    onOpenSource={item.sourceUrl ? () => onOpenSource(item) : undefined}
                    enableSorting={false}
                    expandedTransformOrigin={expandedTransformOrigin}
                    metricsClassName={compact ? TIGHT_DRAGGABLE_ITEM_METRICS_CLASS : undefined}
                    expandedScale={compact ? 1.25 : undefined}
                  />
                ) : (
                  <div key={item.id} className={`relative flex-shrink-0 ${nonIndividualItemClass}`}>
                    <button
                      type="button"
                      onClick={() => onItemClick(item)}
                      onTouchStart={(event) => onItemTouchStart(item.id, event)}
                      onTouchEnd={(event) => onItemTouchEnd(item, event)}
                      onTouchCancel={onItemTouchCancel}
                      className={`group relative h-full w-full cursor-pointer touch-manipulation overflow-hidden rounded-md border transition-colors ${
                        selectedItem?.id === item.id
                          ? "border-amber-400 ring-2 ring-amber-400"
                          : "border-neutral-700 hover:border-neutral-500"
                      }`}
                    >
                      <ItemArtwork
                        src={item.imageUrl}
                        alt={item.label}
                        className="h-full w-full"
                        presentation="ambient"
                      />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-center text-[11px] leading-tight text-neutral-200 opacity-0 transition-opacity group-hover:opacity-100">
                        {item.label}
                      </span>
                    </button>
                    {item.sourceUrl && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onOpenSource(item);
                        }}
                        onTouchStart={(event) => {
                          event.stopPropagation();
                        }}
                        onTouchEnd={(event) => {
                          event.stopPropagation();
                        }}
                        aria-label={`Open source for ${item.label || "item"}`}
                        title="Open source link"
                        className="absolute left-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-sky-400/80 bg-black/70 text-sky-200 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 hover:border-sky-300 hover:text-sky-100"
                      >
                        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ),
              )}
              {tier.items.length === 0 && (
                <span className={`flex items-center text-neutral-600 ${emptyTierClass}`}>
                  No picks
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CompareColumn({
  title,
  tiers,
  selectedItem,
  onItemToggle,
  onOpenSource,
  compact = false,
}: {
  title: string;
  tiers: ConsensusTier[];
  selectedItem: ConsensusItem | null;
  onItemToggle: (item: ConsensusItem) => void;
  onOpenSource: (item: ConsensusItem) => void;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-neutral-100">{title}</h3>
      </div>
      <ResultsTierGrid
        tiers={tiers}
        individualView
        selectedItem={selectedItem}
        onItemToggle={onItemToggle}
        onItemClick={onItemToggle}
        onItemTouchStart={() => undefined}
        onItemTouchEnd={(item) => onItemToggle(item)}
        onItemTouchCancel={() => undefined}
        onOpenSource={onOpenSource}
        compact={compact}
      />
    </div>
  );
}
