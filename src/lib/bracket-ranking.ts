import type { MatchupRow } from "@/types";

/**
 * MIT Backtracking ranking: rank by who beat you, recursively.
 *
 * 1. Winner = rank 1, finalist = rank 2
 * 2. Items that lost to rank 1 and 2 get ranks 3 and 4
 * 3. Items that lost to ranks 3-4 get ranks 5-8, etc.
 *
 * Within the same elimination round, items that lost to higher-ranked
 * opponents get better positions. This avoids the single-elimination bias
 * where the 2nd-best item could be ranked poorly due to an unlucky draw.
 */
export function mitBacktrackRanking(
  matchups: MatchupRow[],
  totalRounds: number,
  allItemIds: string[]
): string[] {
  const finalMatchup = matchups.find((m) => m.round === totalRounds);
  if (!finalMatchup?.winnerId) {
    return fallbackRanking(matchups, totalRounds, allItemIds);
  }

  // Build map: winnerId → list of { loserId, round } they defeated
  const defeated = new Map<string, { loserId: string; round: number }[]>();

  for (const m of matchups) {
    if (!m.winnerId) continue;
    const loserId = m.winnerId === m.itemAId ? m.itemBId : m.itemAId;
    if (!loserId) continue;

    const list = defeated.get(m.winnerId) ?? [];
    list.push({ loserId, round: m.round });
    defeated.set(m.winnerId, list);
  }

  const ranked: string[] = [];
  const seen = new Set<string>();

  // Start with winner, then finalist
  const queue: string[] = [finalMatchup.winnerId];
  const finalistId =
    finalMatchup.winnerId === finalMatchup.itemAId
      ? finalMatchup.itemBId
      : finalMatchup.itemAId;
  if (finalistId) queue.push(finalistId);

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ranked.push(id);

    // Queue items this player defeated, sorted by round descending
    // (later-round losses = they lasted longer, rank them sooner)
    const losses = (defeated.get(id) ?? [])
      .filter((l) => !seen.has(l.loserId))
      .sort((a, b) => b.round - a.round);

    for (const l of losses) {
      queue.push(l.loserId);
    }
  }

  // Catch any items not in the bracket (shouldn't happen, but safety)
  for (const id of allItemIds) {
    if (!seen.has(id)) ranked.push(id);
  }

  return ranked;
}

/** Simple elimination-round ranking fallback (used if bracket is incomplete) */
function fallbackRanking(
  matchups: MatchupRow[],
  totalRounds: number,
  allItemIds: string[]
): string[] {
  const eliminatedInRound = new Map<string, number>();

  const finalMatchup = matchups.find((m) => m.round === totalRounds);
  if (finalMatchup?.winnerId) {
    eliminatedInRound.set(finalMatchup.winnerId, totalRounds + 1);
  }

  for (const m of matchups) {
    if (!m.winnerId) continue;
    const loserId = m.winnerId === m.itemAId ? m.itemBId : m.itemAId;
    if (loserId && !eliminatedInRound.has(loserId)) {
      eliminatedInRound.set(loserId, m.round);
    }
  }

  for (const id of allItemIds) {
    if (!eliminatedInRound.has(id)) eliminatedInRound.set(id, 0);
  }

  return [...allItemIds].sort(
    (a, b) => (eliminatedInRound.get(b) ?? 0) - (eliminatedInRound.get(a) ?? 0)
  );
}
