"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/Button";
import { GearIcon } from "@/components/ui/GearIcon";
import { ChevronDownIcon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useParticipant } from "@/hooks/useParticipant";
import type { SessionLobbyData, TierConfig } from "@/types";
import { TierConfigEditor } from "./TierConfigEditor";

interface SessionLobbyProps {
  session: SessionLobbyData;
}

export function SessionLobby({ session }: SessionLobbyProps) {
  const { participantId } = useParticipant(session.id);
  const [copied, setCopied] = useState(false);
  const [showTierConfig, setShowTierConfig] = useState(false);
  const [tierConfig, setTierConfig] = useState<TierConfig[]>(session.tierConfig);

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{session.name}</h1>
        <p className="text-sm text-neutral-500">
          Template: {session.template.name} &middot; {session.items.length} items
        </p>
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

      {/* Tier Config */}
      {session.status === "OPEN" && (
        <div className="mb-6">
          <button
            onClick={() => setShowTierConfig((v) => !v)}
            className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-400 transition-colors hover:text-neutral-200"
          >
            <GearIcon className="h-4 w-4" />
            Tier Configuration
            <ChevronDownIcon
              className={`h-3 w-3 transition-transform ${showTierConfig ? "rotate-180" : ""}`}
            />
          </button>

          {!showTierConfig && (
            <div className="flex flex-wrap gap-1">
              {tierConfig.map((t, i) => (
                <span
                  key={i}
                  className="rounded px-2 py-0.5 text-xs font-bold"
                  style={{ backgroundColor: t.color, color: "#000" }}
                >
                  {t.label}
                </span>
              ))}
            </div>
          )}

          {showTierConfig && (
            <TierConfigEditor
              sessionId={session.id}
              initialConfig={tierConfig}
              onSaved={(config) => {
                setTierConfig(config);
                setShowTierConfig(false);
              }}
            />
          )}
        </div>
      )}

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
