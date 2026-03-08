"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { saveParticipant } from "@/hooks/useParticipant";
import { useUser } from "@/hooks/useUser";

export function JoinVotePageClient() {
  const router = useRouter();
  const { userId, isLoading: userLoading, error: userError, retry: retryUser } = useUser();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") ?? "";

  const [joinCode, setJoinCode] = useState(codeFromUrl.toUpperCase());
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void join();
  };

  const join = async () => {
    if (joining) return;
    if (!joinCode.trim() || !nickname.trim()) return;
    if (userLoading || !userId) {
      setError("Getting your device ready. Try again in a second.");
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
        setError(typeof data.error === "string" ? data.error : "Could not join this vote");
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
      <Link href="/sessions" className={`${buttonVariants.ghost} mb-4 inline-flex items-center`}>
        &larr; Back to Votes
      </Link>
      <h1 className="mb-6 text-center text-2xl font-bold">Join a Vote</h1>

      <form className="space-y-4" onSubmit={handleSubmit}>
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
                Retry Device Setup
              </Button>
            )}
          </div>
        )}

        <Button
          type="submit"
          disabled={joining || userLoading || !joinCode.trim() || !nickname.trim() || !userId}
          className="w-full py-3"
        >
          {joining ? "Joining..." : "Join Vote"}
        </Button>
      </form>
    </div>
  );
}
