"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiDelete, getErrorMessage } from "@/lib/api-client";

export function RemoveSpaceMemberButton({ spaceId, userId }: { spaceId: string; userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/api/spaces/${spaceId}/members/${userId}`);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Could not remove this member"));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" onClick={remove} disabled={busy} className="!px-3 !py-1 text-xs">
        {busy ? "Removing..." : "Remove"}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
