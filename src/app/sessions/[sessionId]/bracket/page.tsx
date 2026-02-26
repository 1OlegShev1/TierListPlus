"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useParticipant } from "@/hooks/useParticipant";
import { Button } from "@/components/ui/Button";
import type { Matchup, BracketData } from "@/types";

export default function BracketPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { participantId, nickname } = useParticipant(sessionId);
  const [bracket, setBracket] = useState<BracketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentMatchupIndex, setCurrentMatchupIndex] = useState(0);
  const [voting, setVoting] = useState(false);

  const fetchBracket = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}/bracket`);
    if (res.status === 404) {
      // Create bracket
      const createRes = await fetch(`/api/sessions/${sessionId}/bracket`, {
        method: "POST",
      });
      const data = await createRes.json();
      setBracket(data);
    } else {
      const data = await res.json();
      setBracket(data);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    if (!participantId) {
      router.push(`/sessions/join`);
      return;
    }
    fetchBracket();
  }, [participantId, fetchBracket, router]);

  if (!participantId) return null;

  if (loading || !bracket) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-500">
        Loading bracket...
      </div>
    );
  }

  // Get matchups I need to vote on (have both items, I haven't voted yet)
  const myPendingMatchups = bracket.matchups.filter(
    (m) =>
      m.itemA &&
      m.itemB &&
      !(m.votes ?? []).some((v) => v.participantId === participantId)
  );

  const currentMatchup = myPendingMatchups[currentMatchupIndex];

  const handleVote = async (chosenItemId: string) => {
    if (!currentMatchup || voting) return;
    setVoting(true);

    await fetch(`/api/sessions/${sessionId}/bracket/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchupId: currentMatchup.id,
        participantId,
        chosenItemId,
      }),
    });

    setVoting(false);

    if (currentMatchupIndex < myPendingMatchups.length - 1) {
      setCurrentMatchupIndex((i) => i + 1);
    } else {
      // All voted — advance bracket then redirect to tier list
      await fetch(`/api/sessions/${sessionId}/bracket/advance`, {
        method: "POST",
      });
      // Re-fetch to check if more rounds opened up
      const res = await fetch(`/api/sessions/${sessionId}/bracket`);
      const updated = await res.json();
      setBracket(updated);

      const stillPending = updated.matchups.filter(
        (m: Matchup) =>
          m.itemA &&
          m.itemB &&
          !(m.votes ?? []).some((v: { participantId: string }) => v.participantId === participantId)
      );

      if (stillPending.length > 0) {
        setCurrentMatchupIndex(0);
      } else {
        // Bracket complete — proceed to tier list
        router.push(`/sessions/${sessionId}/vote`);
      }
    }
  };

  if (myPendingMatchups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <h2 className="text-xl font-bold">Bracket Voting Complete</h2>
        <p className="text-neutral-500">
          All matchups decided. Proceed to tier ranking.
        </p>
        <Button onClick={() => router.push(`/sessions/${sessionId}/vote`)}>
          Continue to Tier List
        </Button>
      </div>
    );
  }

  const totalVotable = bracket.matchups.filter(
    (m) => m.itemA && m.itemB
  ).length;
  const totalVoted = bracket.matchups.filter((m) =>
    (m.votes ?? []).some((v) => v.participantId === participantId)
  ).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold">Bracket Voting</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Pick your favorite in each matchup &middot; Voting as{" "}
          <span className="text-amber-400">{nickname}</span>
        </p>
        <p className="mt-2 text-xs text-neutral-600">
          {totalVoted}/{totalVotable} matchups voted
        </p>
      </div>

      {currentMatchup && currentMatchup.itemA && currentMatchup.itemB && (
        <div className="flex items-center justify-center gap-6">
          {/* Item A */}
          <button
            onClick={() => handleVote(currentMatchup.itemA!.id)}
            disabled={voting}
            className="group flex w-52 flex-col items-center gap-3 rounded-2xl border-2 border-neutral-700 bg-neutral-900 p-6 transition-all hover:border-amber-400 hover:bg-neutral-800 disabled:opacity-50"
          >
            <img
              src={currentMatchup.itemA.imageUrl}
              alt={currentMatchup.itemA.label}
              className="h-32 w-32 rounded-xl object-cover transition-transform group-hover:scale-105"
            />
            <span className="text-center font-medium">
              {currentMatchup.itemA.label}
            </span>
          </button>

          <span className="text-2xl font-bold text-neutral-600">VS</span>

          {/* Item B */}
          <button
            onClick={() => handleVote(currentMatchup.itemB!.id)}
            disabled={voting}
            className="group flex w-52 flex-col items-center gap-3 rounded-2xl border-2 border-neutral-700 bg-neutral-900 p-6 transition-all hover:border-amber-400 hover:bg-neutral-800 disabled:opacity-50"
          >
            <img
              src={currentMatchup.itemB.imageUrl}
              alt={currentMatchup.itemB.label}
              className="h-32 w-32 rounded-xl object-cover transition-transform group-hover:scale-105"
            />
            <span className="text-center font-medium">
              {currentMatchup.itemB.label}
            </span>
          </button>
        </div>
      )}

      <div className="mt-8 text-center">
        <Button variant="ghost" onClick={() => router.push(`/sessions/${sessionId}/vote`)}>
          Skip bracket &rarr; Go straight to tier list
        </Button>
      </div>
    </div>
  );
}
