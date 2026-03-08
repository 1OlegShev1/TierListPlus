"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { useUser } from "@/hooks/useUser";
import { apiPost, getErrorMessage } from "@/lib/api-client";

export function JoinSpaceByCodeForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const { userId, isLoading: userLoading } = useUser();
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCode(initialCode.toUpperCase());
  }, [initialCode]);

  const canJoin = !!userId && !userLoading && !joining && code.trim().length > 0;

  const join = async () => {
    if (!canJoin) return;
    setJoining(true);
    setError(null);
    try {
      const result = await apiPost<{ spaceId: string }>("/api/spaces/join", {
        code: code.trim().toUpperCase(),
      });
      router.push(`/spaces/${result.spaceId}`);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Could not join this space"));
      setJoining(false);
    }
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
      <h2 className="text-base font-semibold text-neutral-100">Join Private Space</h2>
      <p className="mt-1 text-sm text-neutral-500">Use an invite code from a space owner.</p>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <Input
          className="h-11 font-mono tracking-wide"
          placeholder="Invite code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
        />
        <Button onClick={join} disabled={!canJoin} className="h-11 !px-5 !py-0 !text-sm">
          {joining ? "Joining..." : "Join"}
        </Button>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorMessage message={error} />
        </div>
      )}
    </div>
  );
}
