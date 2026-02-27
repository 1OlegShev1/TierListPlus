"use client";

import { useCallback, useMemo, useState } from "react";
import { MatchupVoter } from "@/components/bracket/MatchupVoter";
import { Button } from "@/components/ui/Button";
import { generateBracket } from "@/lib/bracket-generator";
import { mitBacktrackRanking } from "@/lib/bracket-ranking";
import type { Item, MatchupRow } from "@/types";

interface BracketModalProps {
  items: Item[];
  onComplete: (rankedIds: string[]) => void;
  onCancel: () => void;
}

export function BracketModal({ items, onComplete, onCancel }: BracketModalProps) {
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

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
    (m) => m.itemAId && m.itemBId && !m.winnerId,
  );

  const currentMatchup = pendingMatchups[0];

  const handleVote = useCallback(
    (chosenId: string) => {
      if (!currentMatchup) return;

      setBracketState((prev) => {
        const updated = prev.matchups.map((m) => ({ ...m }));
        const idx = updated.findIndex(
          (m) => m.round === currentMatchup.round && m.position === currentMatchup.position,
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
    [currentMatchup],
  );

  // Check if bracket is complete
  const finalMatchup = bracketState.matchups.find((m) => m.round === bracketState.rounds);
  const isComplete = finalMatchup?.winnerId != null;

  // Derive ranking once bracket is complete
  const allItemIds = useMemo(() => items.map((i) => i.id), [items]);
  const ranked = useMemo(
    () =>
      isComplete ? mitBacktrackRanking(bracketState.matchups, bracketState.rounds, allItemIds) : [],
    [isComplete, bracketState.matchups, bracketState.rounds, allItemIds],
  );
  const handleFinish = useCallback(() => {
    onComplete(ranked);
  }, [ranked, onComplete]);

  // Progress for the current user: only manual head-to-head picks (exclude auto-byes)
  const totalManualVotes = Math.max(items.length - 1, 0);
  const decidedManualVotes = bracketState.matchups.filter(
    (m) => m.itemAId && m.itemBId && m.winnerId,
  ).length;

  const currentRound = currentMatchup?.round ?? bracketState.rounds;

  const itemA = currentMatchup?.itemAId ? itemMap.get(currentMatchup.itemAId) : null;
  const itemB = currentMatchup?.itemBId ? itemMap.get(currentMatchup.itemBId) : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-6">
      <div className="mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 sm:max-h-[calc(100dvh-3rem)]">
        <div className="px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="mb-4 text-center sm:mb-6">
            <h2 className="text-lg font-bold">Rank with Bracket</h2>
            <p className="mt-1 text-xs text-neutral-500">
              {isComplete
                ? "Bracket complete!"
                : `Round ${currentRound} of ${bracketState.rounds} · ${decidedManualVotes}/${totalManualVotes} matchups decided`}
            </p>
            <p className="mt-2 text-[11px] text-neutral-500">
              Applying ranking replaces current placements in this scope. You can still adjust
              before submitting.
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
          {!isComplete && itemA && itemB && (
            <MatchupVoter itemA={itemA} itemB={itemB} size="sm" onVote={handleVote} />
          )}

          {isComplete && (
            <div className="space-y-2">
              <p className="text-center text-sm text-neutral-400">Final ranking:</p>
              <ol className="space-y-1">
                {ranked.map((id, i) => {
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
                })}
              </ol>
            </div>
          )}
        </div>

        <div className="border-t border-neutral-800 bg-neutral-950/95 px-4 py-3 sm:px-6 sm:py-4">
          {/* Progress bar */}
          <div className="h-1 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-1 rounded-full bg-amber-500 transition-all"
              style={{
                width: `${totalManualVotes > 0 ? Math.min(100, (decidedManualVotes / totalManualVotes) * 100) : 0}%`,
              }}
            />
          </div>

          {/* Actions */}
          <div className="mt-3 flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={onCancel}
              className="px-4 text-sm text-neutral-400"
            >
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
    </div>
  );
}

/** Check recursively whether a matchup slot will ever produce a winner */
function willProduceWinner(matchups: MatchupRow[], round: number, position: number): boolean {
  const matchup = matchups.find((m) => m.round === round && m.position === position);
  if (!matchup) return false;
  if (matchup.itemAId || matchup.itemBId) return true;
  if (round <= 1) return false;
  return (
    willProduceWinner(matchups, round - 1, position * 2) ||
    willProduceWinner(matchups, round - 1, position * 2 + 1)
  );
}

/** Advance a matchup's winner into the next round slot */
function advanceWinner(matchups: MatchupRow[], source: MatchupRow, totalRounds: number) {
  if (!source.winnerId || source.round >= totalRounds) return;

  const nextRound = source.round + 1;
  const nextPosition = Math.floor(source.position / 2);
  const slot = source.position % 2 === 0 ? "itemAId" : "itemBId";

  const target = matchups.find((m) => m.round === nextRound && m.position === nextPosition);
  if (!target) return;

  target[slot] = source.winnerId;

  // Only auto-resolve as bye if the other slot's feeder is truly empty
  const emptySlot =
    target.itemAId && !target.itemBId
      ? "itemBId"
      : !target.itemAId && target.itemBId
        ? "itemAId"
        : null;
  if (!emptySlot) return;

  const feederPosition = emptySlot === "itemAId" ? nextPosition * 2 : nextPosition * 2 + 1;
  const isTrueBye = !willProduceWinner(matchups, nextRound - 1, feederPosition);

  if (isTrueBye) {
    target.winnerId = target[emptySlot === "itemAId" ? "itemBId" : "itemAId"];
    advanceWinner(matchups, target, totalRounds);
  }
}
