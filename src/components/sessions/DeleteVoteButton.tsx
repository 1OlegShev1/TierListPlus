"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TrashIcon } from "@/components/ui/icons";
import { useUser } from "@/hooks/useUser";
import { apiDelete, getErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface DeleteVoteButtonProps {
  sessionId: string;
  creatorId: string | null;
  canDeleteOverride?: boolean;
  className?: string;
  label?: string;
}

export function DeleteVoteButton({
  sessionId,
  creatorId,
  canDeleteOverride = false,
  className,
  label,
}: DeleteVoteButtonProps) {
  const { userId } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canDeleteOverride && (!creatorId || creatorId !== userId)) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await apiDelete(`/api/sessions/${sessionId}`);
      router.push("/sessions");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Could not delete this vote"));
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label ?? "Delete vote"}
        title={label ?? "Delete vote"}
        className={cn(
          label
            ? "inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-red-500/50 bg-red-500/10 px-4 text-sm font-medium text-red-200 transition-colors hover:border-red-400 hover:bg-red-500/15 hover:text-red-100"
            : "inline-flex cursor-pointer items-center justify-center rounded-lg p-1 text-red-400 transition-colors hover:bg-red-500/5 hover:text-red-300",
          className,
        )}
      >
        <TrashIcon className={label ? "h-4 w-4" : "h-5 w-5"} />
        {label && <span>{label}</span>}
      </button>
      <ConfirmDialog
        open={open}
        title="Delete Vote"
        description={error ?? "This deletes the whole vote and every ballot. You can't undo it."}
        onConfirm={handleDelete}
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
        preserveLabelWhileLoading
        loading={deleting}
      />
    </>
  );
}
