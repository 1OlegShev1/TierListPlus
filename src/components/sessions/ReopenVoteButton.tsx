"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useUser } from "@/hooks/useUser";
import { apiPatch, getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ReopenVoteButtonProps {
  sessionId: string;
  creatorId: string | null;
  status: string;
  canManageOverride?: boolean;
  className?: string;
  label?: string;
  onReopened?: () => void;
}

export function ReopenVoteButton({
  sessionId,
  creatorId,
  status,
  canManageOverride = false,
  className,
  label = "Reopen vote",
  onReopened,
}: ReopenVoteButtonProps) {
  const { userId } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = canManageOverride || (!!creatorId && creatorId === userId);
  if (!canManage || status !== "CLOSED" || isOpen) return null;

  const handleReopen = async () => {
    if (reopening) return;
    setReopening(true);
    setError(null);
    try {
      await apiPatch(`/api/sessions/${sessionId}`, { status: "OPEN" });
      setOpen(false);
      setIsOpen(true);
      onReopened?.();
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Could not reopen this vote"));
      setReopening(false);
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
          "inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-[var(--state-success-fg)]/45 bg-[var(--state-success-bg)] px-4 text-sm font-medium text-[var(--state-success-fg)] transition-colors hover:border-[var(--state-success-fg)]/70 hover:bg-[var(--state-success-bg)]",
          className,
        )}
      >
        <span>{label}</span>
      </button>
      <ConfirmDialog
        open={open}
        title="Reopen Vote"
        description={
          error ??
          "This reopens voting. People will be able to join again and participants can keep editing rankings."
        }
        confirmLabel="Reopen vote"
        loadingLabel="Reopening..."
        preserveLabelWhileLoading
        confirmVariant="primary"
        onConfirm={handleReopen}
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
        loading={reopening}
      />
    </>
  );
}
