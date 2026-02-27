"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TierListBoard } from "@/components/tierlist/TierListBoard";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { JoinCodeBanner } from "@/components/ui/JoinCodeBanner";
import { Loading } from "@/components/ui/Loading";
import { useParticipant } from "@/hooks/useParticipant";
import { useUser } from "@/hooks/useUser";
import { apiFetch, getErrorMessage } from "@/lib/api-client";
import type { SessionData } from "@/types";

interface ExistingVote {
  tierKey: string;
  rankInTier: number;
  sessionItem: { id: string };
}

interface ExistingVotesResponse {
  votes: ExistingVote[];
}

function buildSeededTiers(votes: ExistingVote[]): Record<string, string[]> {
  const grouped = new Map<string, ExistingVote[]>();
  for (const vote of votes) {
    const bucket = grouped.get(vote.tierKey) ?? [];
    bucket.push(vote);
    grouped.set(vote.tierKey, bucket);
  }

  const seeded: Record<string, string[]> = {};
  for (const [tierKey, tierVotes] of grouped.entries()) {
    seeded[tierKey] = tierVotes
      .sort((a, b) => a.rankInTier - b.rankInTier)
      .map((vote) => vote.sessionItem.id);
  }

  return seeded;
}

export default function VotePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { userId } = useUser();
  const { participantId, nickname } = useParticipant(sessionId);
  const [session, setSession] = useState<SessionData | null>(null);
  const [seededTiers, setSeededTiers] = useState<Record<string, string[]> | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canEditTierConfig = session?.creatorId === userId;

  useEffect(() => {
    if (!participantId) {
      router.push(`/sessions/join`);
      return;
    }

    (async () => {
      try {
        const data = await apiFetch<SessionData>(`/api/sessions/${sessionId}`);
        setSession(data);

        try {
          const existing = await apiFetch<ExistingVotesResponse>(
            `/api/sessions/${sessionId}/votes/${participantId}`,
          );
          setSeededTiers(buildSeededTiers(existing.votes));
        } catch {
          setSeededTiers(undefined);
        }
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load session. Please try again."));
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, participantId, router]);

  if (!participantId) return null;
  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  if (!session || session.status !== "OPEN") {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <p className="text-lg text-neutral-400">This session is no longer accepting votes</p>
        <Button onClick={() => router.push(`/sessions/${sessionId}/results`)}>View Results</Button>
      </div>
    );
  }

  return (
    <div className="-mt-4 flex h-[calc(100%+1rem)] min-h-0 flex-col">
      <div className="mb-2 flex flex-shrink-0 items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">{session.name}</h1>
          <JoinCodeBanner joinCode={session.joinCode} />
        </div>
        <p className="text-sm text-neutral-500">
          Voting as <span className="text-amber-400">{nickname}</span> &middot;{" "}
          {canEditTierConfig
            ? "Use bracket assist to seed rankings, then adjust"
            : "Bracket assist available, then drag items into tiers (tier setup locked by session owner)"}
        </p>
      </div>

      <TierListBoard
        sessionId={sessionId}
        participantId={participantId}
        tierConfig={session.tierConfig}
        sessionItems={session.items}
        seededTiers={seededTiers}
        canEditTierConfig={canEditTierConfig}
        onSubmitted={() => router.push(`/sessions/${sessionId}/results`)}
      />
    </div>
  );
}
