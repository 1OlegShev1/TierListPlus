"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TrashIcon } from "@/components/ui/icons";
import { useUser } from "@/hooks/useUser";
import { apiDelete, getErrorMessage } from "@/lib/api-client";

interface DeleteListButtonProps {
  listId: string;
  creatorId: string | null;
  canDeleteOverride?: boolean;
}

export function DeleteListButton({
  listId,
  creatorId,
  canDeleteOverride = false,
}: DeleteListButtonProps) {
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
      await apiDelete(`/api/templates/${listId}`);
      router.push("/templates");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Could not delete this list"));
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="text-[var(--state-danger-fg)] hover:text-[var(--fg-primary)]"
      >
        <TrashIcon className="h-5 w-5" />
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete List"
        description={
          error ??
          "This deletes this list and all its items. Votes already started from it will still stay up."
        }
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
