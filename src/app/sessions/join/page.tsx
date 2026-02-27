"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { Loading } from "@/components/ui/Loading";
import { saveParticipant } from "@/hooks/useParticipant";
import { useUser } from "@/hooks/useUser";

function JoinSessionForm() {
  const router = useRouter();
  const { userId, isLoading: userLoading, error: userError, retry: retryUser } = useUser();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") ?? "";

  const [joinCode, setJoinCode] = useState(codeFromUrl.toUpperCase());
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const join = async () => {
    if (!joinCode.trim() || !nickname.trim()) return;
    if (userLoading || !userId) {
      setError("Preparing your device identity, please try again.");
      return;
    }
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
      router.push(`/sessions/${sessionId}/vote`);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="mx-auto max-w-md pt-10">
      <h1 className="mb-6 text-center text-2xl font-bold">Join a Session</h1>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-neutral-400">Join Code</span>
          <Input
            type="text"
            placeholder="e.g., ABCD1234"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={20}
            className="w-full py-3 text-center text-xl font-mono tracking-widest"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-neutral-400">Your Nickname</span>
          <Input
            type="text"
            placeholder="e.g., Alex"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            className="w-full"
          />
        </label>

        {(userError || error) && (
          <div className="space-y-2">
            {userError && <ErrorMessage message={userError} />}
            {error && <ErrorMessage message={error} />}
            {userError && (
              <Button variant="secondary" onClick={retryUser} className="w-full">
                Retry Identity Setup
              </Button>
            )}
          </div>
        )}

        <Button
          onClick={join}
          disabled={joining || userLoading || !joinCode.trim() || !nickname.trim() || !userId}
          className="w-full py-3"
        >
          {joining ? "Joining..." : "Join Session"}
        </Button>
      </div>
    </div>
  );
}

export default function JoinSessionPage() {
  return (
    <Suspense fallback={<Loading />}>
      <JoinSessionForm />
    </Suspense>
  );
}
