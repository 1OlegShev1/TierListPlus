"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { saveParticipant } from "@/hooks/useParticipant";
import { useUser } from "@/hooks/useUser";
import { apiPost, getErrorMessage } from "@/lib/api-client";

interface QuickStartVoteButtonProps {
  initialVoteName: string;
  templateId?: string;
  spaceId?: string | null;
  initialNickname?: string | null;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}

export function QuickStartVoteButton({
  initialVoteName,
  templateId,
  spaceId = null,
  initialNickname = null,
  label = "Start Ranking",
  variant = "primary",
  className,
}: QuickStartVoteButtonProps) {
  const router = useRouter();
  const { userId, isLoading: userLoading, error: userError, retry: retryUser } = useUser();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultVoteName = (initialVoteName.trim() || "Untitled Ranking").slice(0, 100);
  const defaultNickname = (initialNickname?.trim() || "Host").slice(0, 30);
  const canCreate = !creating && !userLoading && !!userId;

  const create = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    try {
      const data = await apiPost<{
        id: string;
        participantId: string;
        participantNickname: string;
      }>(spaceId ? `/api/spaces/${spaceId}/sessions` : "/api/sessions", {
        ...(templateId ? { templateId } : {}),
        name: defaultVoteName,
        nickname: defaultNickname,
        ...(spaceId ? {} : { isPrivate: true }),
      });

      saveParticipant(data.id, data.participantId, data.participantNickname);
      router.push(`/sessions/${data.id}/vote`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not start this ranking"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        variant={variant}
        onClick={() => {
          void create();
        }}
        disabled={!canCreate}
        className={className}
      >
        {creating ? "Starting..." : label}
      </Button>

      {(userError || error) && (
        <div className="space-y-2">
          {userError && <ErrorMessage message={userError} />}
          {error && <ErrorMessage message={error} />}
          {userError && (
            <Button variant="secondary" onClick={retryUser}>
              Retry Device Setup
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
