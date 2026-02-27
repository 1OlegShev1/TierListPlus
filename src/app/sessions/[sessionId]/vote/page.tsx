"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DeleteSessionButton } from "@/components/sessions/DeleteSessionButton";
import { TierListBoard } from "@/components/tierlist/TierListBoard";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { JoinCodeBanner } from "@/components/ui/JoinCodeBanner";
import { Loading } from "@/components/ui/Loading";
import { useParticipant } from "@/hooks/useParticipant";
import { useUser } from "@/hooks/useUser";
import { apiFetch, apiPatch, getErrorMessage } from "@/lib/api-client";
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
  const { participantId } = useParticipant(sessionId);
  const [session, setSession] = useState<SessionData | null>(null);
  const [seededTiers, setSeededTiers] = useState<Record<string, string[]> | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockUpdating, setLockUpdating] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const canEditTierConfig = session?.creatorId === userId;
  const isOwner = !!session && !!userId && session.creatorId === userId;

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const data = await apiFetch<SessionData>(`/api/sessions/${sessionId}`);
        if (stale) return;
        setSession(data);
        setIsLocked(data.isLocked);

        if (!participantId) {
          if (data.status !== "OPEN") {
            router.replace(`/sessions/${sessionId}/results`);
            return;
          }
          router.replace(`/sessions/join?code=${encodeURIComponent(data.joinCode)}`);
          return;
        }

        try {
          const existing = await apiFetch<ExistingVotesResponse>(
            `/api/sessions/${sessionId}/votes/${participantId}`,
          );
          if (stale) return;
          setSeededTiers(buildSeededTiers(existing.votes));
        } catch {
          if (stale) return;
          setSeededTiers(undefined);
        }
      } catch (err) {
        if (stale) return;
        setError(getErrorMessage(err, "Failed to load session. Please try again."));
      } finally {
        if (!stale) setLoading(false);
      }
    })();

    return () => {
      stale = true;
    };
  }, [sessionId, participantId, router]);

  const toggleLock = async () => {
    if (!session || !isOwner || lockUpdating) return;
    setLockUpdating(true);
    setLockError(null);
    try {
      await apiPatch(`/api/sessions/${session.id}`, { isLocked: !isLocked });
      setIsLocked((v) => !v);
    } catch (err) {
      setLockError(getErrorMessage(err, "Failed to update session lock"));
    } finally {
      setLockUpdating(false);
    }
  };

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
  if (!participantId) return <Loading message="Redirecting to join..." />;

  return (
    <div className="-mt-2 flex h-[calc(100%+0.5rem)] min-h-0 flex-col sm:-mt-4 sm:h-[calc(100%+1rem)]">
      <div className="mb-1.5 flex flex-shrink-0 flex-col gap-2 md:flex-row md:items-start md:justify-between sm:mb-2 sm:gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold sm:text-2xl">{session.name}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 sm:mt-1 sm:gap-2.5">
            <JoinCodeBanner joinCode={session.joinCode} />
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                isLocked ? "bg-orange-500/20 text-orange-300" : "bg-emerald-500/20 text-emerald-300"
              }`}
            >
              {isLocked ? "Joins locked" : "Joins open"}
            </span>
          </div>
        </div>
        <div className="text-left md:text-right">
          <div className="mt-1.5 flex flex-wrap gap-2 md:justify-end sm:mt-2">
            <Link
              href={`/sessions/${sessionId}/results`}
              className={`${buttonVariants.secondary} !px-3 !py-1.5 !text-sm sm:!px-4 sm:!py-2`}
            >
              View Results
            </Link>
          </div>
          {isOwner && (
            <>
              <details className="mt-1.5 sm:hidden">
                <summary className="cursor-pointer text-xs text-neutral-500">
                  Session actions
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={toggleLock}
                    disabled={lockUpdating}
                    className="rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-300 transition-colors hover:border-amber-500 hover:text-amber-300 disabled:opacity-50"
                  >
                    {lockUpdating ? "Updating..." : isLocked ? "Unlock joins" : "Lock joins"}
                  </button>
                  <DeleteSessionButton sessionId={session.id} creatorId={session.creatorId} />
                </div>
              </details>
              <div className="mt-2 hidden flex-wrap gap-2 md:justify-end sm:flex">
                <button
                  type="button"
                  onClick={toggleLock}
                  disabled={lockUpdating}
                  className="rounded-lg border border-neutral-700 px-3 py-1 text-xs text-neutral-300 transition-colors hover:border-amber-500 hover:text-amber-300 disabled:opacity-50"
                >
                  {lockUpdating ? "Updating..." : isLocked ? "Unlock joins" : "Lock joins"}
                </button>
                <DeleteSessionButton sessionId={session.id} creatorId={session.creatorId} />
              </div>
            </>
          )}
          {lockError && <p className="mt-1 text-xs text-red-400">{lockError}</p>}
        </div>
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
