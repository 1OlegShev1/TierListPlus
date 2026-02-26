"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TierListBoard } from "@/components/tierlist/TierListBoard";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Loading } from "@/components/ui/Loading";
import { useParticipant } from "@/hooks/useParticipant";
import { apiFetch, getErrorMessage } from "@/lib/api-client";
import type { SessionData } from "@/types";

export default function VotePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { participantId, nickname } = useParticipant(sessionId);
  const [session, setSession] = useState<SessionData | null>(null);
  const [seededTiers, setSeededTiers] = useState<Record<string, string[]> | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!participantId) {
      router.push(`/sessions/join`);
      return;
    }

    (async () => {
      try {
        const data = await apiFetch<SessionData>(`/api/sessions/${sessionId}`);
        setSession(data);

        if (data.bracketEnabled) {
          try {
            const { seededTiers: seeds } = await apiFetch<{
              seededTiers: Record<string, string[]>;
            }>(`/api/sessions/${sessionId}/bracket/rankings`);
            setSeededTiers(seeds);
          } catch (err) {
            console.warn("Bracket rankings unavailable:", err);
          }
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
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{session.name}</h1>
        <p className="text-sm text-neutral-500">
          Voting as <span className="text-amber-400">{nickname}</span> &middot;{" "}
          {seededTiers
            ? "Pre-filled from bracket results — adjust as needed"
            : "Drag items into tiers"}
        </p>
      </div>

      <TierListBoard
        sessionId={sessionId}
        participantId={participantId}
        tierConfig={session.tierConfig}
        sessionItems={session.items}
        seededTiers={seededTiers}
        onSubmitted={() => router.push(`/sessions/${sessionId}/results`)}
      />
    </div>
  );
}
