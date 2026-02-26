"use client";

import { useState, useMemo, useCallback } from "react";
import { generateBracket } from "@/lib/bracket-generator";

interface BracketItem {
  id: string;
  label: string;
  imageUrl: string;
}

interface LocalMatchup {
  round: number;
  position: number;
  itemAId: string | null;
  itemBId: string | null;
  winnerId: string | null;
}

interface TierBracketModalProps {
  items: BracketItem[];
  onComplete: (rankedIds: string[]) => void;
  onCancel: () => void;
}

export function TierBracketModal({
  items,
  onComplete,
  onCancel,
}: TierBracketModalProps) {
  const itemMap = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items]
  );

  const [bracketState, setBracketState] = useState(() => {
    const { rounds, matchups } = generateBracket(items.map((i) => i.id));
    const local: LocalMatchup[] = matchups.map((m) => ({
      ...m,
      winnerId: null,
    }));

    // Auto-resolve byes
    for (const m of local) {
      if (m.itemAId && !m.itemBId) {
        m.winnerId = m.itemAId;
      } else if (!m.itemAId && m.itemBId) {
        m.winnerId = m.itemBId;
      }
    }

    // Advance bye winners to next round
    for (const m of local) {
      if (m.winnerId && m.round < rounds) {
        advanceWinner(local, m, rounds);
      }
    }

    return { rounds, matchups: local };
  });

  // Find current votable matchup
  const pendingMatchups = bracketState.matchups.filter(
    (m) => m.itemAId && m.itemBId && !m.winnerId
  );

  const currentMatchup = pendingMatchups[0];

  const handleVote = useCallback(
    (chosenId: string) => {
      if (!currentMatchup) return;

      setBracketState((prev) => {
        const updated = prev.matchups.map((m) => ({ ...m }));
        const idx = updated.findIndex(
          (m) =>
            m.round === currentMatchup.round &&
            m.position === currentMatchup.position
        );
        if (idx === -1) return prev;

        updated[idx].winnerId = chosenId;

        // Advance winner to next round
        if (currentMatchup.round < prev.rounds) {
          advanceWinner(updated, updated[idx], prev.rounds);
        }

        return { ...prev, matchups: updated };
      });
    },
    [currentMatchup]
  );

  // Check if bracket is complete
  const finalMatchup = bracketState.matchups.find(
    (m) => m.round === bracketState.rounds
  );
  const isComplete = finalMatchup?.winnerId != null;

  // When complete, derive ranking and call onComplete
  const handleFinish = useCallback(() => {
    const ranked = deriveRanking(bracketState.matchups, bracketState.rounds);
    onComplete(ranked);
  }, [bracketState, onComplete]);

  // Progress
  const totalVotable = bracketState.matchups.filter(
    (m) => m.itemAId && m.itemBId
  ).length;
  const totalDecided = bracketState.matchups.filter(
    (m) => m.winnerId
  ).length;

  const currentRound = currentMatchup?.round ?? bracketState.rounds;

  const itemA = currentMatchup?.itemAId
    ? itemMap.get(currentMatchup.itemAId)
    : null;
  const itemB = currentMatchup?.itemBId
    ? itemMap.get(currentMatchup.itemBId)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <div className="mb-6 text-center">
          <h2 className="text-lg font-bold">Rank with Bracket</h2>
          <p className="mt-1 text-xs text-neutral-500">
            {isComplete
              ? "Bracket complete!"
              : `Round ${currentRound} of ${bracketState.rounds} · ${totalDecided}/${totalVotable} matchups decided`}
          </p>
        </div>

        {!isComplete && itemA && itemB && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => handleVote(itemA.id)}
              className="group flex w-44 flex-col items-center gap-2 rounded-2xl border-2 border-neutral-700 bg-neutral-900 p-4 transition-all hover:border-amber-400 hover:bg-neutral-800"
            >
              <img
                src={itemA.imageUrl}
                alt={itemA.label}
                className="h-24 w-24 rounded-xl object-cover transition-transform group-hover:scale-105"
              />
              <span className="text-center text-sm font-medium">
                {itemA.label}
              </span>
            </button>

            <span className="text-xl font-bold text-neutral-600">VS</span>

            <button
              onClick={() => handleVote(itemB.id)}
              className="group flex w-44 flex-col items-center gap-2 rounded-2xl border-2 border-neutral-700 bg-neutral-900 p-4 transition-all hover:border-amber-400 hover:bg-neutral-800"
            >
              <img
                src={itemB.imageUrl}
                alt={itemB.label}
                className="h-24 w-24 rounded-xl object-cover transition-transform group-hover:scale-105"
              />
              <span className="text-center text-sm font-medium">
                {itemB.label}
              </span>
            </button>
          </div>
        )}

        {isComplete && (
          <div className="space-y-2">
            <p className="text-center text-sm text-neutral-400">
              Final ranking:
            </p>
            <ol className="space-y-1">
              {deriveRanking(bracketState.matchups, bracketState.rounds).map(
                (id, i) => {
                  const item = itemMap.get(id);
                  if (!item) return null;
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-3 rounded-lg bg-neutral-900 px-3 py-2"
                    >
                      <span className="w-6 text-right text-sm font-bold text-amber-400">
                        {i + 1}
                      </span>
                      <img
                        src={item.imageUrl}
                        alt={item.label}
                        className="h-8 w-8 rounded object-cover"
                      />
                      <span className="text-sm">{item.label}</span>
                    </li>
                  );
                }
              )}
            </ol>
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-1 rounded-full bg-amber-500 transition-all"
            style={{
              width: `${totalVotable > 0 ? (totalDecided / totalVotable) * 100 : 0}%`,
            }}
          />
        </div>

        {/* Actions */}
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400 transition-colors hover:bg-neutral-800"
          >
            Cancel
          </button>
          {isComplete && (
            <button
              onClick={handleFinish}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-amber-400"
            >
              Apply Ranking
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Advance a matchup's winner into the next round slot */
function advanceWinner(
  matchups: LocalMatchup[],
  source: LocalMatchup,
  totalRounds: number
) {
  if (!source.winnerId || source.round >= totalRounds) return;

  const nextRound = source.round + 1;
  const nextPosition = Math.floor(source.position / 2);
  const slot = source.position % 2 === 0 ? "itemAId" : "itemBId";

  const target = matchups.find(
    (m) => m.round === nextRound && m.position === nextPosition
  );
  if (target) {
    target[slot] = source.winnerId;

    // If target now has only one item (other is a bye), auto-resolve
    if (target.itemAId && !target.itemBId) {
      target.winnerId = target.itemAId;
      advanceWinner(matchups, target, totalRounds);
    } else if (!target.itemAId && target.itemBId) {
      target.winnerId = target.itemBId;
      advanceWinner(matchups, target, totalRounds);
    }
  }
}

/**
 * MIT Backtracking ranking algorithm.
 *
 * 1. The final winner gets rank 1, the finalist gets rank 2.
 * 2. Then we backtrack: whoever lost to rank 1 and rank 2 get ranks 3 and 4
 *    (respectively — losing to a higher-ranked opponent gives you a better rank).
 * 3. Then whoever lost to ranks 3 and 4 get ranks 5–8, and so on.
 *
 * This ensures that within the same elimination round, items that lost to
 * stronger opponents rank higher — fixing the bias where the 2nd-best item
 * could end up ranked low due to an unlucky draw.
 */
function deriveRanking(matchups: LocalMatchup[], totalRounds: number): string[] {
  // Build a map: winnerId → list of loserIds they defeated
  const defeated = new Map<string, string[]>();

  for (const m of matchups) {
    if (!m.winnerId) continue;
    const loserId = m.winnerId === m.itemAId ? m.itemBId : m.itemAId;
    if (loserId) {
      const list = defeated.get(m.winnerId) ?? [];
      list.push(loserId);
      defeated.set(m.winnerId, list);
    }
  }

  // Start with the final: winner = rank 1, finalist = rank 2
  const finalMatchup = matchups.find((m) => m.round === totalRounds);
  if (!finalMatchup?.winnerId) {
    // Bracket not complete — fall back to elimination-round ordering
    return fallbackRanking(matchups, totalRounds);
  }

  const ranked: string[] = [];
  // BFS-like: process ranks in order. For each ranked item, find who they
  // beat in earlier rounds and queue them for ranking.
  const queue: string[] = [finalMatchup.winnerId];

  // Finalist
  const finalistId =
    finalMatchup.winnerId === finalMatchup.itemAId
      ? finalMatchup.itemBId
      : finalMatchup.itemAId;
  if (finalistId) queue.push(finalistId);

  const seen = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ranked.push(id);

    // Find items this player defeated (excluding the one already ranked
    // from the final matchup progression), ordered so that earlier-round
    // losses come later in the ranking.
    const losses = defeated.get(id) ?? [];
    // Items defeated by this player, not yet ranked, sorted by round
    // (later rounds first = they lasted longer before losing to this player)
    const unrankedLosses = losses
      .filter((lid) => !seen.has(lid))
      .sort((a, b) => {
        // Find which round they lost in
        const roundA = matchups.find(
          (m) =>
            m.winnerId === id &&
            (m.itemAId === a || m.itemBId === a)
        )?.round ?? 0;
        const roundB = matchups.find(
          (m) =>
            m.winnerId === id &&
            (m.itemAId === b || m.itemBId === b)
        )?.round ?? 0;
        return roundB - roundA; // later round = better rank
      });

    for (const lid of unrankedLosses) {
      queue.push(lid);
    }
  }

  // Catch any items missed (byes that never played a real match, etc.)
  const allIds = new Set<string>();
  for (const m of matchups) {
    if (m.itemAId) allIds.add(m.itemAId);
    if (m.itemBId) allIds.add(m.itemBId);
  }
  for (const id of allIds) {
    if (!seen.has(id)) ranked.push(id);
  }

  return ranked;
}

/** Fallback: simple elimination-round ranking (used if bracket is incomplete) */
function fallbackRanking(matchups: LocalMatchup[], totalRounds: number): string[] {
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

  const allIds = new Set<string>();
  for (const m of matchups) {
    if (m.itemAId) allIds.add(m.itemAId);
    if (m.itemBId) allIds.add(m.itemBId);
  }

  for (const id of allIds) {
    if (!eliminatedInRound.has(id)) eliminatedInRound.set(id, 0);
  }

  return [...allIds].sort((a, b) => {
    return (eliminatedInRound.get(b) ?? 0) - (eliminatedInRound.get(a) ?? 0);
  });
}
