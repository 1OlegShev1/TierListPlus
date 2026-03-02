"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "@/hooks/useUser";
import { apiPost, getErrorMessage } from "@/lib/api-client";
import { Button } from "../ui/Button";
import { ErrorMessage } from "../ui/ErrorMessage";

interface DuplicateTemplateButtonProps {
  templateId: string;
}

export function DuplicateTemplateButton({ templateId }: DuplicateTemplateButtonProps) {
  const router = useRouter();
  const { userId, isLoading: userLoading, error: userError, retry } = useUser();
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duplicate = async () => {
    if (userLoading || !userId) return;

    setDuplicating(true);
    setError(null);

    try {
      const template = await apiPost<{ id: string }>(`/api/templates/${templateId}/duplicate`, {});
      router.push(`/templates/${template.id}/edit`);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to duplicate template"));
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
        {duplicating ? "Duplicating..." : "Duplicate to Edit"}
      </Button>
      {userError && (
        <>
          <ErrorMessage message={userError} />
          <Button variant="ghost" onClick={retry}>
            Retry Identity Setup
          </Button>
        </>
      )}
      {error && <ErrorMessage message={error} />}
    </div>
  );
}
