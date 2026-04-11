"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { GearIcon } from "@/components/ui/GearIcon";
import { Input } from "@/components/ui/Input";
import { ThemedTooltip } from "@/components/ui/ThemedTooltip";
import { apiPatch, getErrorMessage } from "@/lib/api-client";
import { VoteVisibilityField } from "./VoteVisibilityField";

interface VoteSettingsButtonProps {
  sessionId: string;
  initialNickname: string;
  initialIsPrivate: boolean;
  canManageSession: boolean;
  isSpaceSession: boolean;
  onNicknameChange: (nickname: string) => void;
  onPrivacyChange: (isPrivate: boolean) => void;
}

export function VoteSettingsButton({
  sessionId,
  initialNickname,
  initialIsPrivate,
  canManageSession,
  isSpaceSession,
  onNicknameChange,
  onPrivacyChange,
}: VoteSettingsButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState(initialNickname);
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setNickname(initialNickname);
    setIsPrivate(initialIsPrivate);
    setError(null);
  }, [open, initialNickname, initialIsPrivate]);

  const trimmedNickname = nickname.trim();
  const canEditPrivacy = canManageSession && !isSpaceSession;
  const privacyHelperText = isSpaceSession
    ? "Visibility for space rankings is managed in Space Settings."
    : "Off by default. People can still join private rankings with the code.";

  const nicknameHasChanges = trimmedNickname !== initialNickname;
  const privacyHasChanges = canEditPrivacy && isPrivate !== initialIsPrivate;
  const hasChanges = privacyHasChanges || nicknameHasChanges;
  const canSave = !saving && hasChanges && !!trimmedNickname;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (privacyHasChanges) {
        await apiPatch(`/api/sessions/${sessionId}`, { isPrivate });
      }

      if (nicknameHasChanges) {
        await apiPatch<{ participantId: string; nickname: string }>(
          `/api/sessions/${sessionId}/participants/me`,
          {
            nickname: trimmedNickname,
          },
        );
      }

      if (nicknameHasChanges) {
        onNicknameChange(trimmedNickname);
      }
      if (privacyHasChanges) {
        onPrivacyChange(isPrivate);
      }

      setOpen(false);
    } catch (err) {
      setError(getErrorMessage(err, "Could not update ranking settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <span className="group relative inline-flex">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open ranking settings"
          className="peer inline-flex h-10 w-10 items-center justify-center text-[var(--fg-subtle)] transition-colors hover:text-[var(--fg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <GearIcon className="h-5 w-5" />
        </button>
        <ThemedTooltip className="max-w-[14rem] text-[0.68rem]">
          Open ranking settings
        </ThemedTooltip>
      </span>

      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          if (saving) {
            event.preventDefault();
            return;
          }
          setOpen(false);
        }}
        onClose={() => {
          if (!saving) {
            setOpen(false);
          }
        }}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),32rem)] overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-left text-[var(--fg-primary)] shadow-2xl shadow-black/60 backdrop:bg-[var(--bg-overlay)] focus:outline-none sm:p-6"
      >
        <h2 className="text-lg font-bold">Ranking settings</h2>

        <div className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[var(--fg-secondary)]">
              Your nickname
            </span>
            <Input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={30}
              disabled={saving}
              className="w-full"
            />
          </label>

          <VoteVisibilityField
            isPrivate={isPrivate}
            onChange={setIsPrivate}
            disabled={!canEditPrivacy || saving}
            helperText={privacyHelperText}
          />

          {error && <ErrorMessage message={error} />}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button onClick={save} disabled={!canSave} className="w-full sm:w-auto">
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
