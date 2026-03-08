"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useUser } from "@/hooks/useUser";
import { apiPost, getErrorMessage } from "@/lib/api-client";

export function CopyListToSpaceButton({
  spaceId,
  sourceTemplateId,
}: {
  spaceId: string;
  sourceTemplateId: string;
}) {
  const router = useRouter();
  const { userId, isLoading: userLoading, error: userError, retry } = useUser();
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copyInFlightRef = useRef(false);

  const copyToSpace = async () => {
    if (copying || copyInFlightRef.current || userLoading || !userId) return;
    copyInFlightRef.current = true;
    setCopying(true);
    setError(null);
    let shouldReset = true;

    try {
      const copied = await apiPost<{ id: string }>(`/api/spaces/${spaceId}/templates/import`, {
        sourceTemplateId,
      });
      router.push(`/templates/${copied.id}/edit`);
      router.refresh();
      shouldReset = false;
    } catch (err) {
      setError(getErrorMessage(err, "Could not copy this list into the space"));
    } finally {
      if (!shouldReset) {
        return;
      }
      copyInFlightRef.current = false;
      setCopying(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="secondary"
        size="equalAction"
        onClick={copyToSpace}
        disabled={copying || userLoading || !userId}
      >
        {copying ? "Copying..." : "Copy to Space"}
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
