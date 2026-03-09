import type { ConsensusTier } from "@/lib/consensus";
import type { CompareDifferenceStateByItemId } from "./ResultsTierGrid";

function buildItemTierKeyMap(tiers: ConsensusTier[]) {
  const map = new Map<string, string>();
  for (const tier of tiers) {
    for (const item of tier.items) {
      map.set(item.id, tier.key);
    }
  }
  return map;
}

export function buildCompareDifferenceStates({
  leftTiers,
  rightTiers,
}: {
  leftTiers: ConsensusTier[];
  rightTiers: ConsensusTier[];
}): {
  left: CompareDifferenceStateByItemId;
  right: CompareDifferenceStateByItemId;
} {
  const leftTierByItemId = buildItemTierKeyMap(leftTiers);
  const rightTierByItemId = buildItemTierKeyMap(rightTiers);
  const left: CompareDifferenceStateByItemId = {};
  const right: CompareDifferenceStateByItemId = {};

  for (const [itemId, leftTierKey] of leftTierByItemId.entries()) {
    const rightTierKey = rightTierByItemId.get(itemId);
    left[itemId] = rightTierKey && rightTierKey === leftTierKey ? "same" : "changed";
  }
  for (const [itemId, rightTierKey] of rightTierByItemId.entries()) {
    const leftTierKey = leftTierByItemId.get(itemId);
    right[itemId] = leftTierKey && leftTierKey === rightTierKey ? "same" : "changed";
  }

  return { left, right };
}
