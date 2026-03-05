import type { TierConfig } from "@/types";

/**
 * Convert a full ranked list into tier buckets.
 *
 * For session-wide bracket seeding we avoid equal tier sizes, which tends to
 * look artificial. We use a middle-heavy profile optimized for "good first
 * pass" UX: very top tier stays small, middle tiers can hold more.
 */
export function seedTiersFromRanking(
  rankedIds: string[],
  tierConfig: TierConfig[],
): Record<string, string[]> {
  const sortedTiers = [...tierConfig].sort((a, b) => a.sortOrder - b.sortOrder);
  const tierCount = sortedTiers.length;
  const itemCount = rankedIds.length;
  const bucketSizes = computeMiddleBulkBucketSizes(itemCount, tierCount);

  const seededTiers: Record<string, string[]> = {};
  let cursor = 0;

  for (let i = 0; i < tierCount; i++) {
    const size = bucketSizes[i] ?? 0;
    seededTiers[sortedTiers[i].key] = rankedIds.slice(cursor, cursor + size);
    cursor += size;
  }

  return seededTiers;
}

function computeMiddleBulkBucketSizes(itemCount: number, tierCount: number): number[] {
  if (tierCount <= 0) return [];
  if (itemCount <= 0) return Array(tierCount).fill(0);

  // If there are fewer items than tiers, place one per top tier.
  if (itemCount <= tierCount) {
    return Array.from({ length: tierCount }, (_, i) => (i < itemCount ? 1 : 0));
  }

  if (tierCount === 1) return [itemCount];
  if (tierCount === 2) {
    const top = Math.max(1, Math.min(itemCount - 1, Math.round(itemCount * 0.45)));
    return [top, itemCount - top];
  }

  const weights = getMiddleBulkWeights(tierCount);
  const rawCounts = weights.map((w) => itemCount * w);
  const sizes = rawCounts.map((v) => Math.floor(v));
  const remainder = itemCount - sizes.reduce((sum, n) => sum + n, 0);

  if (remainder > 0) {
    const center = (tierCount - 1) / 2;
    const order = rawCounts
      .map((v, i) => ({
        index: i,
        fraction: v - Math.floor(v),
        distToCenter: Math.abs(i - center),
      }))
      .sort(
        (a, b) => b.fraction - a.fraction || a.distToCenter - b.distToCenter || a.index - b.index,
      );

    for (let i = 0; i < remainder; i++) {
      sizes[order[i % order.length].index] += 1;
    }
  }

  return sizes;
}

function getMiddleBulkWeights(tierCount: number): number[] {
  if (tierCount === 3) return [0.2, 0.55, 0.25];
  if (tierCount === 4) return [0.12, 0.33, 0.33, 0.22];
  if (tierCount === 5) return [0.08, 0.27, 0.33, 0.2, 0.12];

  const center = (tierCount - 1) / 2;
  const denom = center || 1;
  const raw = Array.from({ length: tierCount }, (_, i) => {
    const normDist = Math.abs(i - center) / denom;
    let weight = 1 - 0.75 * normDist; // center-heavy baseline
    if (i === 0) weight *= 0.65;
    if (i === tierCount - 1) weight *= 0.85;
    return Math.max(0.05, weight);
  });

  const sum = raw.reduce((acc, v) => acc + v, 0);
  return raw.map((w) => w / sum);
}
