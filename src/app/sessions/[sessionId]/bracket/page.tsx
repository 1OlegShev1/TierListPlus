"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MatchupVoter } from "@/components/bracket/MatchupVoter";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Loading } from "@/components/ui/Loading";
import { useParticipant } from "@/hooks/useParticipant";
import { ApiClientError, apiFetch, apiPost, getErrorMessage } from "@/lib/api-client";
import type { BracketData, Matchup } from "@/types";

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
      const data = await apiFetch<BracketData>(`/api/sessions/${sessionId}/bracket`);
      setBracket(data);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) {
        // Bracket doesn't exist yet — create it
        try {
          const data = await apiPost<BracketData>(`/api/sessions/${sessionId}/bracket`, {});
          setBracket(data);
        } catch (createErr) {
          setError(getErrorMessage(createErr, "Failed to create bracket."));
        }
      } else {
        setError(getErrorMessage(err, "Failed to load bracket. Please try again."));
      }
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
  if (error)
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <ErrorMessage message={error} />
        <Button
          variant="secondary"
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchBracket();
          }}
        >
          Retry
        </Button>
      </div>
    );
  if (!bracket) return null;

  const myPendingMatchups = bracket.matchups.filter(
    (m) => m.itemA && m.itemB && !(m.votes ?? []).some((v) => v.participantId === participantId),
  );

  const currentMatchup = myPendingMatchups[currentMatchupIndex];

  const handleVote = async (chosenItemId: string) => {
    if (!currentMatchup || voting) return;
    setVoting(true);

    try {
      await apiPost(`/api/sessions/${sessionId}/bracket/vote`, {
        matchupId: currentMatchup.id,
        participantId,
        chosenItemId,
      });

      if (currentMatchupIndex < myPendingMatchups.length - 1) {
        setCurrentMatchupIndex((i) => i + 1);
      } else {
        await apiFetch(`/api/sessions/${sessionId}/bracket/advance`, { method: "POST" });
        const updated = await apiFetch<BracketData>(`/api/sessions/${sessionId}/bracket`);
        setBracket(updated);

        const stillPending = updated.matchups.filter(
          (m: Matchup) =>
            m.itemA &&
            m.itemB &&
            !(m.votes ?? []).some(
              (v: { participantId: string }) => v.participantId === participantId,
            ),
        );

        if (stillPending.length > 0) {
          setCurrentMatchupIndex(0);
        } else {
          router.push(`/sessions/${sessionId}/vote`);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to submit vote. Please try again."));
    } finally {
      setVoting(false);
    }
  };

  if (myPendingMatchups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <h2 className="text-xl font-bold">Bracket Voting Complete</h2>
        <p className="text-neutral-500">All matchups decided. Proceed to tier ranking.</p>
        <Button onClick={() => router.push(`/sessions/${sessionId}/vote`)}>
          Continue to Tier List
        </Button>
      </div>
    );
  }

  const totalVotable = bracket.matchups.filter((m) => m.itemA && m.itemB).length;
  const totalVoted = bracket.matchups.filter((m) =>
    (m.votes ?? []).some((v) => v.participantId === participantId),
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

      {currentMatchup?.itemA && currentMatchup.itemB && (
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
