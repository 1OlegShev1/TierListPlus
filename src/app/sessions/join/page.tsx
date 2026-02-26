"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useParticipant } from "@/hooks/useParticipant";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function JoinSessionPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  // We don't know the session ID yet, so we'll save after joining
  const join = async () => {
    if (!joinCode.trim() || !nickname.trim()) return;
    setJoining(true);
    setError("");

    try {
      const res = await fetch("/api/sessions/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          joinCode: joinCode.trim().toUpperCase(),
          nickname: nickname.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to join");
        return;
      }

      const { sessionId, participantId, nickname: savedNickname } = await res.json();

      // Save to localStorage
      const storageKey = "tierlistplus_participants";
      const all = JSON.parse(localStorage.getItem(storageKey) || "{}");
      all[sessionId] = { participantId, nickname: savedNickname };
      localStorage.setItem(storageKey, JSON.stringify(all));

      router.push(`/sessions/${sessionId}`);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="mx-auto max-w-md pt-10">
      <h1 className="mb-6 text-center text-2xl font-bold">Join a Session</h1>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-400">
            Join Code
          </label>
          <Input
            type="text"
            placeholder="e.g., ABCD1234"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={20}
            className="w-full py-3 text-center text-xl font-mono tracking-widest"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-neutral-400">
            Your Nickname
          </label>
          <Input
            type="text"
            placeholder="e.g., Alex"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            className="w-full"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <Button
          onClick={join}
          disabled={joining || !joinCode.trim() || !nickname.trim()}
          className="w-full py-3"
        >
          {joining ? "Joining..." : "Join Session"}
        </Button>
      </div>
    </div>
  );
}
