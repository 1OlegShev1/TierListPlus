"use client";

import Link from "next/link";
import { useState } from "react";
import { DeleteSessionButton } from "@/components/sessions/DeleteSessionButton";
import { buttonVariants } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useParticipant } from "@/hooks/useParticipant";
import type { SessionLobbyData } from "@/types";

interface SessionLobbyProps {
  session: SessionLobbyData;
}

export function SessionLobby({ session }: SessionLobbyProps) {
  const { participantId } = useParticipant(session.id);
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(session.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isJoined = !!participantId;
  const voteUrl = session.bracketEnabled
    ? `/sessions/${session.id}/bracket`
    : `/sessions/${session.id}/vote`;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{session.name}</h1>
          <p className="text-sm text-neutral-500">
            Template: {session.template.name} &middot; {session.items.length} items
          </p>
        </div>
        <DeleteSessionButton sessionId={session.id} creatorId={session.creatorId} />
      </div>

      {/* Join Code */}
      <div className="mb-8 rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-center">
        <p className="mb-2 text-sm text-neutral-400">Share this code with your team</p>
        <button
          onClick={copyCode}
          className="text-4xl font-mono font-bold tracking-[0.3em] text-amber-400 transition-colors hover:text-amber-300"
        >
          {session.joinCode}
        </button>
        <p className="mt-2 text-xs text-neutral-500">{copied ? "Copied!" : "Click to copy"}</p>
      </div>

      {/* Status */}
      <div className="mb-6 flex items-center gap-3">
        <StatusBadge status={session.status} />
        {session.bracketEnabled && (
          <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-400">
            Bracket Voting
          </span>
        )}
      </div>

      {/* Participants */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-neutral-400">
          Participants ({session._count.participants})
        </h2>
        {session.participants.length === 0 ? (
          <p className="text-sm text-neutral-600">No one has joined yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {session.participants.map((p) => (
              <span
                key={p.id}
                className={`rounded-full border px-3 py-1 text-sm ${
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
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-neutral-400">Tiers</h2>
        <div className="flex flex-wrap gap-1">
          {session.tierConfig.map((t) => (
            <span
              key={t.key}
              className="rounded px-2 py-0.5 text-xs font-bold"
              style={{ backgroundColor: t.color, color: "#000" }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {isJoined && session.status === "OPEN" && (
          <Link href={voteUrl} className={buttonVariants.primary}>
            Start Voting
          </Link>
        )}
        {!isJoined && session.status === "OPEN" && (
          <Link href={`/sessions/join?code=${session.joinCode}`} className={buttonVariants.primary}>
            Join Session
          </Link>
        )}
        <Link href={`/sessions/${session.id}/results`} className={buttonVariants.secondary}>
          View Results
        </Link>
      </div>
    </div>
  );
}
