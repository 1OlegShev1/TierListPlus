import type { Item, TierConfig } from "@/types";

interface VoteData {
  sessionItemId: string;
  tierKey: string;
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
  // Assign numeric scores: top tier gets highest score
  const maxSort = Math.max(...tierConfig.map((t) => t.sortOrder));
  const tierScores: Record<string, number> = {};
  for (const tier of tierConfig) {
    tierScores[tier.key] = maxSort - tier.sortOrder + 1;
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
    stats.totalScore += tierScores[vote.tierKey] ?? 0;
    stats.count += 1;
    stats.distribution[vote.tierKey] = (stats.distribution[vote.tierKey] ?? 0) + 1;
  }

  // Enrich items with scores
  const enrichedItems: ConsensusItem[] = sessionItems.map((item) => {
    const stats = itemStats.get(item.id)!;
    return {
      ...item,
      averageScore: stats.count > 0 ? stats.totalScore / stats.count : 0,
      voteDistribution: stats.distribution,
      totalVotes: stats.count,
    };
  });

  // Assign items to tiers
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
