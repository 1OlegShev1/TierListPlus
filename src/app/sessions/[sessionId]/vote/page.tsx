"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useParticipant } from "@/hooks/useParticipant";
import { TierListBoard } from "@/components/tierlist/TierListBoard";
import { TierConfigEditor } from "@/components/sessions/TierConfigEditor";
import type { TierConfig } from "@/lib/constants";

interface SessionData {
  id: string;
  name: string;
  status: string;
  bracketEnabled: boolean;
  tierConfig: TierConfig[];
  items: { id: string; label: string; imageUrl: string }[];
}

export default function VotePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { participantId, nickname } = useParticipant(sessionId);
  const [session, setSession] = useState<SessionData | null>(null);
  const [seededTiers, setSeededTiers] = useState<Record<string, string[]> | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!participantId) {
      router.push(`/sessions/join?code=`);
      return;
    }

    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then(async (data: SessionData) => {
        setSession(data);

        // If bracket voting was enabled, fetch rankings to pre-populate tiers
        if (data.bracketEnabled) {
          try {
            const rankingsRes = await fetch(
              `/api/sessions/${sessionId}/bracket/rankings`
            );
            if (rankingsRes.ok) {
              const { seededTiers: seeds } = await rankingsRes.json();
              setSeededTiers(seeds);
            }
          } catch {
            // Bracket rankings unavailable — start with blank tiers
          }
        }

        setLoading(false);
      });
  }, [sessionId, participantId, router]);

  if (!participantId) {
    return null;
  }

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-500">
        Loading...
      </div>
    );
  }

  if (session.status !== "OPEN") {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <p className="text-lg text-neutral-400">This session is no longer accepting votes</p>
        <button
          onClick={() => router.push(`/sessions/${sessionId}/results`)}
          className="rounded-lg bg-amber-500 px-6 py-2 font-medium text-black"
        >
          View Results
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{session.name}</h1>
          <p className="text-sm text-neutral-500">
            Voting as <span className="text-amber-400">{nickname}</span> &middot;
            {seededTiers
              ? "Pre-filled from bracket results — adjust as needed"
              : "Drag items into tiers"}
          </p>
        </div>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className={`rounded-lg border p-2 transition-colors ${
            showSettings
              ? "border-amber-500 bg-amber-500/10 text-amber-400"
              : "border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          }`}
          title="Tier settings"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {showSettings && (
        <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="mb-3 text-sm font-medium text-neutral-300">Tier Settings</h3>
          <TierConfigEditor
            sessionId={sessionId}
            initialConfig={session.tierConfig}
            onSaved={(config) => {
              setSession({ ...session, tierConfig: config });
              setShowSettings(false);
            }}
          />
        </div>
      )}

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
