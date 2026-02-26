"use client";

import { useState, useMemo, useCallback } from "react";
import { generateBracket } from "@/lib/bracket-generator";
import { mitBacktrackRanking } from "@/lib/bracket-ranking";
import { Button } from "@/components/ui/Button";
import { MatchupVoter } from "@/components/bracket/MatchupVoter";
import type { Item, MatchupRow } from "@/types";

interface BracketModalProps {
  items: Item[];
  onComplete: (rankedIds: string[]) => void;
  onCancel: () => void;
}

export function BracketModal({
  items,
  onComplete,
  onCancel,
}: BracketModalProps) {
  const itemMap = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items]
  );

  const [bracketState, setBracketState] = useState(() => {
    const { rounds, matchups } = generateBracket(items.map((i) => i.id));
    const local: MatchupRow[] = matchups.map((m) => ({
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
  const allItemIds = useMemo(() => items.map((i) => i.id), [items]);
  const handleFinish = useCallback(() => {
    const ranked = mitBacktrackRanking(bracketState.matchups, bracketState.rounds, allItemIds);
    onComplete(ranked);
  }, [bracketState, allItemIds, onComplete]);

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
          <MatchupVoter
            itemA={itemA}
            itemB={itemB}
            size="sm"
            onVote={handleVote}
          />
        )}

        {isComplete && (
          <div className="space-y-2">
            <p className="text-center text-sm text-neutral-400">
              Final ranking:
            </p>
            <ol className="space-y-1">
              {mitBacktrackRanking(bracketState.matchups, bracketState.rounds, allItemIds).map(
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
          <Button variant="secondary" onClick={onCancel} className="px-4 text-sm text-neutral-400">
            Cancel
          </Button>
          {isComplete && (
            <Button onClick={handleFinish} className="px-4 text-sm">
              Apply Ranking
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Advance a matchup's winner into the next round slot */
function advanceWinner(
  matchups: MatchupRow[],
  source: MatchupRow,
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

