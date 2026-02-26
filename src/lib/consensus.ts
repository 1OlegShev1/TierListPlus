import type { Item, TierConfig } from "@/types";

interface VoteData {
  participantId: string;
  sessionItemId: string;
  tierKey: string;
  rankInTier: number;
}

export interface ConsensusItem {
  id: string;
  label: string;
  imageUrl: string;
  averageScore: number;
  voteDistribution: Record<string, number>;
  totalVotes: number;
}

export interface ConsensusTier {
  key: string;
  label: string;
  color: string;
  sortOrder: number;
  items: ConsensusItem[];
}

export function computeConsensus(
  votes: VoteData[],
  tierConfig: TierConfig[],
  sessionItems: Item[],
): ConsensusTier[] {
  // Assign integer tier scores: top tier gets highest score
  const maxSort = Math.max(...tierConfig.map((t) => t.sortOrder));
  const tierScores: Record<string, number> = {};
  for (const tier of tierConfig) {
    tierScores[tier.key] = maxSort - tier.sortOrder + 1;
  }

  // Count how many items each voter placed in each tier.
  // Needed to normalize rankInTier to a [0, 1) bonus so that
  // within-tier ordering can never cross a tier boundary.
  const voterTierCounts = new Map<string, Map<string, number>>();
  for (const vote of votes) {
    let tierCounts = voterTierCounts.get(vote.participantId);
    if (!tierCounts) {
      tierCounts = new Map();
      voterTierCounts.set(vote.participantId, tierCounts);
    }
    tierCounts.set(vote.tierKey, (tierCounts.get(vote.tierKey) ?? 0) + 1);
  }

  // Compute per-item stats
  const itemStats = new Map<
    string,
    { totalScore: number; count: number; distribution: Record<string, number> }
  >();

  for (const item of sessionItems) {
    itemStats.set(item.id, { totalScore: 0, count: 0, distribution: {} });
  }

  for (const vote of votes) {
    const stats = itemStats.get(vote.sessionItemId);
    if (!stats) continue;

    const tierCount =
      voterTierCounts.get(vote.participantId)?.get(vote.tierKey) ?? 1;

    // Normalized bonus in [0, 1): rank 0 (best) → (tierCount-1)/tierCount,
    // last rank → 0. Single-item tiers get 0 (no ordering to express).
    const withinTierBonus =
      tierCount > 1 ? (tierCount - 1 - vote.rankInTier) / tierCount : 0;

    stats.totalScore += tierScores[vote.tierKey] + withinTierBonus;
    stats.count += 1;
    stats.distribution[vote.tierKey] =
      (stats.distribution[vote.tierKey] ?? 0) + 1;
  }

  // Enrich items with scores
  const enrichedItems: ConsensusItem[] = sessionItems.map((item) => {
    const stats = itemStats.get(item.id) ?? {
      totalScore: 0,
      count: 0,
      distribution: {},
    };
    return {
      ...item,
      averageScore: stats.count > 0 ? stats.totalScore / stats.count : 0,
      voteDistribution: stats.distribution,
      totalVotes: stats.count,
    };
  });

  // Assign items to tiers by closest tier score
  const tierResults: Record<string, ConsensusItem[]> = {};
  for (const tier of tierConfig) {
    tierResults[tier.key] = [];
  }

  for (const item of enrichedItems) {
    if (item.totalVotes === 0) {
      // Unvoted items go to the lowest tier
      const lowestTier = tierConfig[tierConfig.length - 1];
      tierResults[lowestTier.key].push(item);
      continue;
    }

    let closestTier = tierConfig[tierConfig.length - 1].key;
    let closestDist = Infinity;
    for (const tier of tierConfig) {
      const dist = Math.abs(item.averageScore - tierScores[tier.key]);
      if (dist < closestDist) {
        closestDist = dist;
        closestTier = tier.key;
      }
    }
    tierResults[closestTier].push(item);
  }

  // Sort within each tier by average score descending
  for (const key of Object.keys(tierResults)) {
    tierResults[key].sort((a, b) => b.averageScore - a.averageScore);
  }

  return tierConfig.map((tier) => ({
    ...tier,
    items: tierResults[tier.key],
  }));
}
