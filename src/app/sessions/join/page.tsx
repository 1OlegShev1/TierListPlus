"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveParticipant } from "@/hooks/useParticipant";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

export default function JoinSessionPage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

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
        setError(typeof data.error === "string" ? data.error : "Failed to join");
        return;
      }

      const { sessionId, participantId, nickname: savedNickname } = await res.json();

      saveParticipant(sessionId, participantId, savedNickname);
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

        {error && <ErrorMessage message={error} />}

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
