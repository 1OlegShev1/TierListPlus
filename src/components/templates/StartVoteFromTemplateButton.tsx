"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { saveParticipant } from "@/hooks/useParticipant";
import { useUser } from "@/hooks/useUser";
import { apiPost, getErrorMessage } from "@/lib/api-client";

interface StartVoteFromTemplateButtonProps {
  templateId: string;
  templateName: string;
}

export function StartVoteFromTemplateButton({
  templateId,
  templateName,
}: StartVoteFromTemplateButtonProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const voteNameRef = useRef<HTMLInputElement>(null);
  const { userId, isLoading: userLoading, error: userError, retry: retryUser } = useUser();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      voteNameRef.current?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  const canCreate = !!name.trim() && !!nickname.trim() && !creating && !userLoading && !!userId;

  const closeModal = () => {
    if (creating) return;
    setOpen(false);
    setError("");
  };

  const create = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError("");
    try {
      const data = await apiPost<{
        id: string;
        participantId: string;
        participantNickname: string;
      }>("/api/sessions", {
        templateId,
        name: name.trim(),
        nickname: nickname.trim(),
        isPrivate: true,
      });

      saveParticipant(data.id, data.participantId, data.participantNickname);
      setOpen(false);
      router.push(`/sessions/${data.id}/vote`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not start this vote"));
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void create();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>Start Vote</Button>

      <dialog
        ref={dialogRef}
        onCancel={(e) => {
          if (creating) {
            e.preventDefault();
            return;
          }
          setOpen(false);
          setError("");
        }}
        onClose={() => {
          if (!creating) {
            setOpen(false);
          }
        }}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),32rem)] overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-left text-white shadow-2xl shadow-black/60 backdrop:bg-black/70 focus:outline-none sm:p-6"
      >
        <h2 className="text-lg font-bold">Start Vote</h2>
        <p className="mt-2 text-sm text-neutral-400">
          This vote will start from{" "}
          <span className="font-medium text-neutral-200">{templateName}</span>.
        </p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-300">Vote Name</span>
            <Input
              ref={voteNameRef}
              type="text"
              placeholder="e.g., Best Burgers in Town"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-neutral-300">Your Nickname</span>
            <Input
              type="text"
              placeholder="e.g., Alex"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
              className="w-full"
            />
          </label>

          {(userError || error) && (
            <div className="space-y-2">
              {userError && <ErrorMessage message={userError} />}
              {error && <ErrorMessage message={error} />}
              {userError && (
                <Button variant="secondary" onClick={retryUser}>
                  Retry Device Setup
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={closeModal}
              disabled={creating}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canCreate} className="w-full sm:w-auto">
              {creating ? "Starting..." : "Start Vote"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
