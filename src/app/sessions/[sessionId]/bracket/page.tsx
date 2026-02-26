"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useParticipant } from "@/hooks/useParticipant";
import { Button } from "@/components/ui/Button";
import { Loading } from "@/components/ui/Loading";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { MatchupVoter } from "@/components/bracket/MatchupVoter";
import type { Matchup, BracketData } from "@/types";

export default function BracketPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { participantId, nickname } = useParticipant(sessionId);
  const [bracket, setBracket] = useState<BracketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMatchupIndex, setCurrentMatchupIndex] = useState(0);
  const [voting, setVoting] = useState(false);

  const fetchBracket = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/bracket`);
      if (res.status === 404) {
        const createRes = await fetch(`/api/sessions/${sessionId}/bracket`, {
          method: "POST",
        });
        if (!createRes.ok) throw new Error("Failed to create bracket");
        setBracket(await createRes.json());
      } else if (!res.ok) {
        throw new Error("Failed to load bracket");
      } else {
        setBracket(await res.json());
      }
    } catch {
      setError("Failed to load bracket. Please try again.");
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
  if (loading) return <Loading message="Loading bracket..." />;
  if (error) return <ErrorMessage message={error} />;
  if (!bracket) return null;

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

    try {
      await fetch(`/api/sessions/${sessionId}/bracket/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchupId: currentMatchup.id,
          participantId,
          chosenItemId,
        }),
      });

      if (currentMatchupIndex < myPendingMatchups.length - 1) {
        setCurrentMatchupIndex((i) => i + 1);
      } else {
        await fetch(`/api/sessions/${sessionId}/bracket/advance`, {
          method: "POST",
        });
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
          router.push(`/sessions/${sessionId}/vote`);
        }
      }
    } catch {
      setError("Failed to submit vote. Please try again.");
    } finally {
      setVoting(false);
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
        <MatchupVoter
          itemA={currentMatchup.itemA}
          itemB={currentMatchup.itemB}
          disabled={voting}
          onVote={handleVote}
        />
      )}

      <div className="mt-8 text-center">
        <Button variant="ghost" onClick={() => router.push(`/sessions/${sessionId}/vote`)}>
          Skip bracket &rarr; Go straight to tier list
        </Button>
      </div>
    </div>
  );
}
