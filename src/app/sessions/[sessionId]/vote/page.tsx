"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useParticipant } from "@/hooks/useParticipant";
import { TierListBoard } from "@/components/tierlist/TierListBoard";
import type { TierConfig } from "@/lib/constants";

interface SessionData {
  id: string;
  name: string;
  status: string;
  tierConfig: TierConfig[];
  items: { id: string; label: string; imageUrl: string }[];
}

export default function VotePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { participantId, nickname } = useParticipant(sessionId);
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!participantId) {
      router.push(`/sessions/join?code=`);
      return;
    }

    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        setSession(data);
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{session.name}</h1>
        <p className="text-sm text-neutral-500">
          Voting as <span className="text-amber-400">{nickname}</span> &middot;
          Drag items into tiers
        </p>
      </div>

      <TierListBoard
        sessionId={sessionId}
        participantId={participantId}
        tierConfig={session.tierConfig}
        sessionItems={session.items}
        onSubmitted={() => router.push(`/sessions/${sessionId}/results`)}
      />
    </div>
  );
}
