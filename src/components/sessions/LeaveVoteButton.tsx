"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useParticipant } from "@/hooks/useParticipant";
import { apiDelete, getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface LeaveVoteButtonProps {
  sessionId: string;
  joinCode: string;
  isLocked?: boolean;
  className?: string;
  label?: string;
}

export function LeaveVoteButton({
  sessionId,
  joinCode,
  isLocked = false,
  className,
  label = "Leave vote",
}: LeaveVoteButtonProps) {
  const router = useRouter();
  const { clear: clearParticipant } = useParticipant(sessionId);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const description = isLocked
    ? "This removes your ballot from this vote. Joins are currently locked, so you will not be able to rejoin unless a host unlocks joins."
    : "This removes your ballot from this vote. You can rejoin while voting is open, but you will start from scratch.";

  const handleLeave = async () => {
    if (leaving) return;
    setLeaving(true);
    setError(null);
    try {
      await apiDelete(`/api/sessions/${sessionId}/participants/me`);
      clearParticipant();
      setOpen(false);
      router.push(`/sessions/join?code=${encodeURIComponent(joinCode)}`);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Could not leave this vote"));
      setLeaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--state-danger-fg)]/45 bg-[var(--state-danger-bg)] px-4 text-sm font-medium text-[var(--state-danger-fg)] transition-colors hover:border-[var(--state-danger-fg)]/70 hover:bg-[var(--state-danger-bg)]",
          className,
        )}
      >
        <span>{label}</span>
      </button>
      <ConfirmDialog
        open={open}
        title="Leave vote"
        description={error ?? description}
        confirmLabel="Leave vote"
        loadingLabel="Leaving..."
        preserveLabelWhileLoading
        confirmVariant="danger"
        onConfirm={handleLeave}
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
        loading={leaving}
      />
    </>
  );
}
