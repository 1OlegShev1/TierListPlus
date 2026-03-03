"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "@/hooks/useUser";
import { apiPost, getErrorMessage } from "@/lib/api-client";
import { Button } from "../ui/Button";
import { ErrorMessage } from "../ui/ErrorMessage";

interface DuplicateListButtonProps {
  listId: string;
}

export function DuplicateListButton({ listId }: DuplicateListButtonProps) {
  const router = useRouter();
  const { userId, isLoading: userLoading, error: userError, retry } = useUser();
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duplicate = async () => {
    if (userLoading || !userId) return;

    setDuplicating(true);
    setError(null);

    try {
      const list = await apiPost<{ id: string }>(`/api/templates/${listId}/duplicate`, {});
      router.push(`/templates/${list.id}/edit`);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Could not copy this list"));
      setDuplicating(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="secondary"
        onClick={duplicate}
        disabled={duplicating || userLoading || !userId}
      >
        {duplicating ? "Copying..." : "Make Your Own Copy"}
      </Button>
      {userError && (
        <>
          <ErrorMessage message={userError} />
          <Button variant="ghost" onClick={retry}>
            Retry Device Setup
          </Button>
        </>
      )}
      {error && <ErrorMessage message={error} />}
    </div>
  );
}
