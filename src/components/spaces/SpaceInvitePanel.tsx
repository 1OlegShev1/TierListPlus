"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { apiFetch, apiPost, getErrorMessage } from "@/lib/api-client";

interface InvitePayload {
  code: string;
  expiresAt: string;
}

export function SpaceInvitePanel({ spaceId }: { spaceId: string }) {
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadInvite = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await apiFetch<{ invite: InvitePayload | null }>(
          `/api/spaces/${spaceId}/invite`,
        );
        if (!mounted) return;
        setInvite(payload.invite);
      } catch (err) {
        if (!mounted) return;
        setError(getErrorMessage(err, "Could not load invite code"));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void loadInvite();
    return () => {
      mounted = false;
    };
  }, [spaceId]);

  const rotateInvite = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await apiPost<InvitePayload>(`/api/spaces/${spaceId}/invite`, {});
      setInvite(payload);
    } catch (err) {
      setError(getErrorMessage(err, "Could not rotate invite code"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.code);
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="text-sm font-semibold text-neutral-100">Private Invite</h3>
      <p className="mt-1 text-xs text-neutral-500">Single reusable code with 7-day expiry.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={rotateInvite} disabled={busy || loading}>
          {busy ? "Generating..." : invite ? "Rotate code" : "Generate code"}
        </Button>
        {invite && (
          <button
            type="button"
            onClick={copy}
            className="rounded-md border border-neutral-700 px-3 py-1.5 font-mono text-sm tracking-wider text-amber-300 hover:border-amber-500/70"
          >
            {invite.code}
          </button>
        )}
      </div>
      {error && (
        <div className="mt-3">
          <ErrorMessage message={error} />
        </div>
      )}
    </div>
  );
}
