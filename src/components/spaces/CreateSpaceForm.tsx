"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useUser } from "@/hooks/useUser";
import { apiPost, getErrorMessage } from "@/lib/api-client";

export function CreateSpaceForm() {
  const router = useRouter();
  const { userId, isLoading: userLoading } = useUser();
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "OPEN">("PRIVATE");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = !!userId && !userLoading && !creating && name.trim().length > 0;

  const createSpace = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    try {
      const created = await apiPost<{ id: string }>("/api/spaces", {
        name: name.trim(),
        visibility,
      });
      router.push(`/spaces/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create this space"));
      setCreating(false);
    }
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5">
      <h2 className="text-base font-semibold text-neutral-100">Create a Space</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Private for friend groups, open for communities.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
        <Input
          placeholder="e.g., Anime Lovers"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Select
          value={visibility}
          onChange={(event) => setVisibility(event.target.value as "PRIVATE" | "OPEN")}
        >
          <option value="PRIVATE">Private</option>
          <option value="OPEN">Open</option>
        </Select>
        <Button onClick={createSpace} disabled={!canCreate}>
          {creating ? "Creating..." : "Create"}
        </Button>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorMessage message={error} />
        </div>
      )}
    </div>
  );
}
