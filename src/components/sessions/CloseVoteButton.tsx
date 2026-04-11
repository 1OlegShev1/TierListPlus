"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ThemedTooltip } from "@/components/ui/ThemedTooltip";
import { useUser } from "@/hooks/useUser";
import { apiPatch, getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type CloseVoteButtonVariant = "accent" | "secondary";

interface CloseVoteButtonProps {
  sessionId: string;
  creatorId: string | null;
  status: string;
  canManageOverride?: boolean;
  variant?: CloseVoteButtonVariant;
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
  variant = "accent",
  className,
  label = "Close ranking",
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
  const buttonClassName =
    variant === "secondary" ? buttonVariants.secondary : buttonVariants.accent;

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
      setError(getErrorMessage(err, "Could not end this ranking"));
      setClosing(false);
    }
  };

  return (
    <>
      <span className="group relative inline-flex">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          className={cn("peer", buttonClassName, className)}
        >
          <span>{label}</span>
        </button>
        <ThemedTooltip className="max-w-[14rem]">{label}</ThemedTooltip>
      </span>
      <ConfirmDialog
        open={open}
        title="Close ranking"
        description={
          error ??
          "This closes ranking for everyone. No one can join or change rankings after this. Results will stay available."
        }
        confirmLabel="Close ranking"
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
