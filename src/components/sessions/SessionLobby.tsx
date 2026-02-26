"use client";

import Link from "next/link";
import { useState } from "react";
import { useParticipant } from "@/hooks/useParticipant";
import { TierConfigEditor } from "./TierConfigEditor";
import type { TierConfig } from "@/lib/constants";

interface SessionLobbyProps {
  session: {
    id: string;
    name: string;
    joinCode: string;
    status: string;
    bracketEnabled: boolean;
    tierConfig: TierConfig[];
    template: { name: string };
    participants: { id: string; nickname: string; createdAt: string }[];
    items: { id: string; label: string; imageUrl: string }[];
    _count: { participants: number };
  };
}

export function SessionLobby({ session }: SessionLobbyProps) {
  const { participantId, nickname } = useParticipant(session.id);
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
        <p className="mt-2 text-xs text-neutral-500">
          {copied ? "Copied!" : "Click to copy"}
        </p>
      </div>

      {/* Status */}
      <div className="mb-6 flex items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            session.status === "OPEN"
              ? "bg-green-500/20 text-green-400"
              : session.status === "CLOSED"
              ? "bg-red-500/20 text-red-400"
              : "bg-neutral-500/20 text-neutral-400"
          }`}
        >
          {session.status}
        </span>
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
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Tier Configuration
            <svg
              className={`h-3 w-3 transition-transform ${showTierConfig ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
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
          <Link
            href={voteUrl}
            className="rounded-lg bg-amber-500 px-6 py-2 font-medium text-black transition-colors hover:bg-amber-400"
          >
            Start Voting
          </Link>
        )}
        {!isJoined && session.status === "OPEN" && (
          <Link
            href={`/sessions/join?code=${session.joinCode}`}
            className="rounded-lg bg-amber-500 px-6 py-2 font-medium text-black transition-colors hover:bg-amber-400"
          >
            Join Session
          </Link>
        )}
        <Link
          href={`/sessions/${session.id}/results`}
          className="rounded-lg border border-neutral-700 px-6 py-2 text-neutral-300 transition-colors hover:bg-neutral-800"
        >
          View Results
        </Link>
      </div>
    </div>
  );
}
