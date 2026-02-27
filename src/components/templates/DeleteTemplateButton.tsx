"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TrashIcon } from "@/components/ui/icons";
import { useUser } from "@/hooks/useUser";
import { apiDelete, getErrorMessage } from "@/lib/api-client";

interface DeleteTemplateButtonProps {
  templateId: string;
  creatorId: string | null;
}

export function DeleteTemplateButton({ templateId, creatorId }: DeleteTemplateButtonProps) {
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
      await apiDelete(`/api/templates/${templateId}`);
      router.push("/templates");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete template"));
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
        title="Delete Template"
        description={
          error ??
          "This will permanently delete this template and all its items. Sessions created from it will not be affected."
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
