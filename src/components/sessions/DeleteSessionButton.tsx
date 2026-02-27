"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TrashIcon } from "@/components/ui/icons";
import { useUser } from "@/hooks/useUser";
import { apiDelete, getErrorMessage } from "@/lib/api-client";

interface DeleteSessionButtonProps {
  sessionId: string;
  creatorId: string | null;
}

export function DeleteSessionButton({ sessionId, creatorId }: DeleteSessionButtonProps) {
  const { userId } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!creatorId || creatorId !== userId) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await apiDelete(`/api/sessions/${sessionId}`);
      router.push("/sessions");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete session"));
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="text-red-400 hover:text-red-300"
      >
        <TrashIcon className="h-5 w-5" />
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete Session"
        description={
          error ??
          "This will permanently delete this session, all votes, participants, and bracket data. This cannot be undone."
        }
        onConfirm={handleDelete}
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
        loading={deleting}
      />
    </>
  );
}
