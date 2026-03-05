"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CloseVoteButton } from "@/components/sessions/CloseVoteButton";
import { DeleteVoteButton } from "@/components/sessions/DeleteVoteButton";
import { TierListBoard } from "@/components/tierlist/TierListBoard";
import { LockClosedIcon, LockOpenIcon } from "@/components/ui/icons";
import { JoinCodeBanner } from "@/components/ui/JoinCodeBanner";
import { useParticipant } from "@/hooks/useParticipant";
import { apiPatch, getErrorMessage } from "@/lib/api-client";
import type { SessionData } from "@/types";

const resultsLinkClassName =
  "inline-flex items-center rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-500/15 hover:text-amber-200";
const statusBadgeBaseClassName =
  "inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium";

export function VotePageClient({
  sessionId,
  session,
  resolvedParticipantId,
  seededTiers,
  currentUserId,
}: {
  sessionId: string;
  session: SessionData;
  resolvedParticipantId: string;
  seededTiers: Record<string, string[]>;
  currentUserId: string | null;
}) {
  const router = useRouter();
  const { save: saveParticipant, clear: clearParticipant } = useParticipant(sessionId);
  const [isLocked, setIsLocked] = useState(session.isLocked);
  const [lockUpdating, setLockUpdating] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const canEditTierConfig = session.canManageSession;
  const isOwner = session.canManageSession;

  useEffect(() => {
    if (session.currentParticipantId && session.currentParticipantNickname) {
      saveParticipant(session.currentParticipantId, session.currentParticipantNickname);
      return;
    }
    clearParticipant();
  }, [
    clearParticipant,
    saveParticipant,
    session.currentParticipantId,
    session.currentParticipantNickname,
  ]);

  const toggleLock = async () => {
    if (!isOwner || lockUpdating) return;
    setLockUpdating(true);
    setLockError(null);
    try {
      await apiPatch(`/api/sessions/${session.id}`, { isLocked: !isLocked });
      setIsLocked((value) => !value);
    } catch (err) {
      setLockError(getErrorMessage(err, "Failed to update session lock"));
    } finally {
      setLockUpdating(false);
    }
  };

  const joinStatusLabel = isLocked ? "Joins locked" : "Joins open";
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
          {session.spaceId && (
            <Link
              href={`/spaces/${session.spaceId}?tab=votes`}
              className="mt-1 inline-flex text-xs text-amber-400 transition-colors hover:text-amber-300"
            >
              {`In ${session.spaceName ?? "space"} · back to space votes`}
            </Link>
          )}
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
                aria-busy={lockUpdating || undefined}
                className={`${statusBadgeBaseClassName} ${joinStatusToneClassName} ${joinStatusHoverClassName} min-w-[126px] shrink-0 justify-center cursor-pointer transition-colors disabled:cursor-wait disabled:opacity-80`}
              >
                <JoinStatusIcon className="h-4 w-4" />
                {joinStatusLabel}
              </button>
            ) : (
              <span
                className={`${statusBadgeBaseClassName} ${joinStatusToneClassName} min-w-[126px] shrink-0 justify-center`}
              >
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
              canManageOverride={session.canManageSession}
              className="shrink-0"
              redirectHref={`/sessions/${sessionId}/results`}
            />
            {isOwner && (
              <DeleteVoteButton
                sessionId={session.id}
                creatorId={session.creatorId}
                canDeleteOverride={session.canManageSession}
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
        canSaveTemplate={!!currentUserId}
        canManageItems={session.canManageItems}
        templateIsHidden={session.templateIsHidden}
        onSubmitted={() => router.push(`/sessions/${sessionId}/results`)}
      />
    </div>
  );
}
