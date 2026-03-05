"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useUser } from "@/hooks/useUser";
import { apiPatch, getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface CloseVoteButtonProps {
  sessionId: string;
  creatorId: string | null;
  status: string;
  canManageOverride?: boolean;
  className?: string;
  label?: string;
  redirectHref?: string;
  onClosed?: () => void;
}

export function CloseVoteButton({
  sessionId,
  creatorId,
  status,
  canManageOverride = false,
  className,
  label = "Close vote",
  redirectHref,
  onClosed,
}: CloseVoteButtonProps) {
  const { userId } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = canManageOverride || (!!creatorId && creatorId === userId);
  if (!canManage || status !== "OPEN" || isClosed) return null;

  const handleClose = async () => {
    if (closing) return;
    setClosing(true);
    setError(null);
    try {
      await apiPatch(`/api/sessions/${sessionId}`, { status: "CLOSED" });
      setOpen(false);
      setIsClosed(true);
      onClosed?.();
      if (redirectHref) {
        router.push(redirectHref);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Could not close this vote"));
      setClosing(false);
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
          "inline-flex cursor-pointer items-center justify-center rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-200 transition-colors hover:border-amber-400 hover:bg-amber-500/15 hover:text-amber-100",
          className,
        )}
      >
        <span>{label}</span>
      </button>
      <ConfirmDialog
        open={open}
        title="Close Vote"
        description={
          error ??
          "This ends voting for everyone. No one can join or change rankings after this. Results will stay available."
        }
        confirmLabel="Close vote"
        loadingLabel="Closing..."
        preserveLabelWhileLoading
        confirmVariant="primary"
        onConfirm={handleClose}
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
        loading={closing}
      />
    </>
  );
}
