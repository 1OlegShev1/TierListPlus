"use client";

import Link from "next/link";
import { useState } from "react";
import { DeleteSessionButton } from "@/components/sessions/DeleteSessionButton";
import { buttonVariants } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useParticipant } from "@/hooks/useParticipant";
import { useUser } from "@/hooks/useUser";
import { apiPatch, getErrorMessage } from "@/lib/api-client";
import type { SessionLobbyData } from "@/types";

interface SessionLobbyProps {
  session: SessionLobbyData;
}

export function SessionLobby({ session }: SessionLobbyProps) {
  const { userId } = useUser();
  const { participantId } = useParticipant(session.id);
  const [copied, setCopied] = useState(false);
  const [isLocked, setIsLocked] = useState(session.isLocked);
  const [lockUpdating, setLockUpdating] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const isOwner = !!userId && session.creatorId === userId;

  const copyCode = () => {
    navigator.clipboard.writeText(session.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isJoined = !!participantId;
  const voteUrl = `/sessions/${session.id}/vote`;
  const canJoinSession = session.status === "OPEN" && !isLocked;
  const submittedCount = session.participants.filter((p) => p.hasSubmitted).length;
  const hasSubmitted = !!session.participants.find((p) => p.id === participantId)?.hasSubmitted;

  const toggleLock = async () => {
    if (!isOwner || lockUpdating) return;
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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{session.name}</h1>
          <p className="mt-1 text-base text-neutral-500">
            Template: {session.template.name} &middot; {session.items.length} items
          </p>
        </div>
        <DeleteSessionButton sessionId={session.id} creatorId={session.creatorId} />
      </div>

      {/* Join Code */}
      <div className="mb-10 rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center">
        <p className="mb-3 text-base text-neutral-400">Share this code with your team</p>
        <button
          type="button"
          onClick={copyCode}
          title="Click to copy"
          className="cursor-pointer rounded-lg px-6 py-3 text-5xl font-mono font-bold tracking-[0.3em] text-amber-400 transition-all hover:bg-amber-400/10 hover:text-amber-300"
        >
          {session.joinCode}
        </button>
        <p className="mt-3 text-sm text-neutral-500">{copied ? "Copied!" : "Click to copy"}</p>
      </div>

      {/* Status */}
      <div className="mb-8 flex items-center gap-3">
        <StatusBadge status={session.status} />
        <span
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            session.isPrivate
              ? "bg-blue-500/20 text-blue-300"
              : "bg-emerald-500/20 text-emerald-300"
          }`}
        >
          {session.isPrivate ? "Private" : "Public"}
        </span>
        <span
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            isLocked ? "bg-orange-500/20 text-orange-300" : "bg-emerald-500/20 text-emerald-300"
          }`}
        >
          {isLocked ? "Locked" : "Open to join"}
        </span>
        {session.bracketEnabled && (
          <span className="rounded-full bg-purple-500/20 px-4 py-1.5 text-sm font-medium text-purple-400">
            Bracket Assist
          </span>
        )}
        {isOwner && session.status === "OPEN" && (
          <button
            type="button"
            onClick={toggleLock}
            disabled={lockUpdating}
            className="cursor-pointer rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:border-amber-500 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {lockUpdating ? "Updating..." : isLocked ? "Unlock joins" : "Lock joins"}
          </button>
        )}
      </div>
      {lockError && (
        <div className="mb-6">
          <ErrorMessage message={lockError} />
        </div>
      )}

      {/* Participants */}
      <div className="mb-8">
        <h2 className="mb-3 text-base font-medium text-neutral-400">
          Participants ({session._count.participants}) &middot; {submittedCount} submitted
        </h2>
        {session.participants.length === 0 ? (
          <p className="text-base text-neutral-600">No one has joined yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {session.participants.map((p) => (
              <span
                key={p.id}
                className={`rounded-full border px-4 py-1.5 text-base ${
                  p.id === participantId
                    ? "border-amber-500 bg-amber-500/10 text-amber-400"
                    : "border-neutral-700 text-neutral-300"
                }`}
              >
                {p.nickname}
                {p.id === participantId && " (you)"}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tier Preview */}
      <div className="mb-8">
        <h2 className="mb-3 text-base font-medium text-neutral-400">Tiers</h2>
        <div className="flex flex-wrap gap-1.5">
          {session.tierConfig.map((t) => (
            <span
              key={t.key}
              className="rounded px-3 py-1 text-sm font-bold"
              style={{ backgroundColor: t.color, color: "#000" }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* Items Preview */}
      <div className="mb-8">
        <h2 className="mb-3 text-base font-medium text-neutral-400">
          Items to Vote On ({session.items.length})
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {session.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2"
            >
              <img
                src={item.imageUrl}
                alt={item.label}
                className="h-10 w-10 flex-shrink-0 rounded object-cover"
              />
              <span className="truncate text-sm text-neutral-200">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {isJoined && session.status === "OPEN" && (
          <Link href={voteUrl} className={buttonVariants.primary}>
            {hasSubmitted ? "Edit My Vote" : "Start Voting"}
          </Link>
        )}
        {!isJoined && canJoinSession && (
          <Link href={`/sessions/join?code=${session.joinCode}`} className={buttonVariants.primary}>
            Join Session
          </Link>
        )}
        {!isJoined && session.status === "OPEN" && isLocked && (
          <span className="inline-flex items-center rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-400">
            Joining is locked
          </span>
        )}
        <Link href={`/sessions/${session.id}/results`} className={buttonVariants.secondary}>
          View Results
        </Link>
      </div>
    </div>
  );
}
