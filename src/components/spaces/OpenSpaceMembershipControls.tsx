"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useUser } from "@/hooks/useUser";
import { apiDelete, apiPost, getErrorMessage } from "@/lib/api-client";

interface OpenSpaceMembershipControlsProps {
  spaceId: string;
  isMember: boolean;
  isOwner: boolean;
}

export function OpenSpaceMembershipControls({
  spaceId,
  isMember,
  isOwner,
}: OpenSpaceMembershipControlsProps) {
  const router = useRouter();
  const { userId, isLoading: userLoading } = useUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!userId || userLoading) return null;

  const join = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/spaces/${spaceId}/members`, {});
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Could not join this space"));
      setBusy(false);
    }
  };

  const leave = async () => {
    if (busy || isOwner) return;
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/api/spaces/${spaceId}/members/me`);
      router.push("/spaces");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Could not leave this space"));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {!isMember ? (
        <Button onClick={join} disabled={busy}>
          {busy ? "Joining..." : "Join Space"}
        </Button>
      ) : !isOwner ? (
        <Button
          variant="secondary"
          onClick={leave}
          disabled={busy}
          className="hover:border-[var(--border-strong)] hover:text-[var(--fg-primary)]"
        >
          {busy ? "Leaving...?" : "Leave Space"}
        </Button>
      ) : null}
      {error && <ErrorMessage message={error} />}
    </div>
  );
}
