"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CloseVoteButton } from "@/components/sessions/CloseVoteButton";
import { DeleteVoteButton } from "@/components/sessions/DeleteVoteButton";
import { TierListBoard } from "@/components/tierlist/TierListBoard";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LockClosedIcon, LockOpenIcon } from "@/components/ui/icons";
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

const resultsLinkClassName =
  "inline-flex items-center rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-500/15 hover:text-amber-200";
const statusBadgeBaseClassName =
  "inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium";

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
  const {
    participantId,
    save: saveParticipant,
    clear: clearParticipant,
  } = useParticipant(sessionId);
  const [session, setSession] = useState<SessionData | null>(null);
  const [seededTiers, setSeededTiers] = useState<Record<string, string[]> | undefined>(undefined);
  const [resolvedParticipantId, setResolvedParticipantId] = useState<string | null>(null);
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

        const currentParticipantId = data.currentParticipantId;
        if (!currentParticipantId) {
          clearParticipant();
          setResolvedParticipantId(null);
          if (data.status !== "OPEN") {
            router.replace(`/sessions/${sessionId}/results`);
            return;
          }
          router.replace(`/sessions/join?code=${encodeURIComponent(data.joinCode)}`);
          return;
        }

        setResolvedParticipantId(currentParticipantId);
        if (
          data.currentParticipantNickname &&
          (participantId !== currentParticipantId || !participantId)
        ) {
          saveParticipant(currentParticipantId, data.currentParticipantNickname);
        }

        const existing = await apiFetch<ExistingVotesResponse>(
          `/api/sessions/${sessionId}/votes/${currentParticipantId}`,
        );
        if (stale) return;
        setSeededTiers(buildSeededTiers(existing.votes));
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
  }, [sessionId, participantId, clearParticipant, saveParticipant, router]);

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
        <Link href={`/sessions/${sessionId}/results`} className={resultsLinkClassName}>
          View Results
        </Link>
      </div>
    );
  }
  if (!resolvedParticipantId) return <Loading message="Redirecting to join..." />;

  const joinStatusLabel = lockUpdating ? "Updating..." : isLocked ? "Joins locked" : "Joins open";
  const joinStatusToneClassName = isLocked
    ? "border-orange-500/40 bg-orange-500/10 text-orange-200"
    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  const joinStatusHoverClassName = isLocked
    ? "hover:border-orange-400/70 hover:bg-orange-500/15"
    : "hover:border-emerald-400/70 hover:bg-emerald-500/15";
  const JoinStatusIcon = isLocked ? LockClosedIcon : LockOpenIcon;

  return (
    <div className="-mt-2 flex flex-col pb-3 sm:-mt-4 sm:pb-4">
      <div className="mb-1.5 flex flex-shrink-0 flex-col gap-2 md:flex-row md:items-start md:justify-between sm:mb-2 sm:gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold sm:text-2xl">{session.name}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 sm:mt-1 sm:gap-2.5">
            <JoinCodeBanner joinCode={session.joinCode} />
          </div>
        </div>
        <div className="text-left md:text-right">
          <div className="mt-1.5 flex flex-wrap items-center gap-2 md:justify-end sm:mt-2">
            {isOwner ? (
              <button
                type="button"
                onClick={toggleLock}
                disabled={lockUpdating}
                aria-label={isLocked ? "Unlock joins" : "Lock joins"}
                title={isLocked ? "Unlock joins" : "Lock joins"}
                className={`${statusBadgeBaseClassName} ${joinStatusToneClassName} ${joinStatusHoverClassName} shrink-0 cursor-pointer transition-colors disabled:cursor-wait disabled:opacity-80`}
              >
                <JoinStatusIcon className="h-4 w-4" />
                {joinStatusLabel}
              </button>
            ) : (
              <span className={`${statusBadgeBaseClassName} ${joinStatusToneClassName} shrink-0`}>
                <JoinStatusIcon className="h-4 w-4" />
                {joinStatusLabel}
              </span>
            )}
            <Link
              href={`/sessions/${sessionId}/results`}
              className={`${resultsLinkClassName} shrink-0 whitespace-nowrap`}
            >
              <span className="sm:hidden">Results</span>
              <span className="hidden sm:inline">View Results</span>
            </Link>
            <CloseVoteButton
              sessionId={session.id}
              creatorId={session.creatorId}
              status={session.status}
              className="shrink-0"
              redirectHref={`/sessions/${sessionId}/results`}
            />
            {isOwner && (
              <DeleteVoteButton
                sessionId={session.id}
                creatorId={session.creatorId}
                label="Delete"
                className="shrink-0"
              />
            )}
          </div>
          {lockError && <p className="mt-1 text-xs text-red-400">{lockError}</p>}
        </div>
      </div>

      <TierListBoard
        key={sessionId}
        sessionId={sessionId}
        participantId={resolvedParticipantId}
        tierConfig={session.tierConfig}
        sessionItems={session.items}
        seededTiers={seededTiers}
        canEditTierConfig={canEditTierConfig}
        canSaveTemplate={!!userId}
        canManageItems={session.canManageItems}
        templateIsHidden={session.templateIsHidden}
        onSubmitted={() => router.push(`/sessions/${sessionId}/results`)}
      />
    </div>
  );
}
