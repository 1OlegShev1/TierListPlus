"use client";

import { useState } from "react";
import { EyeIcon, EyeSlashIcon } from "@/components/ui/icons";
import { ThemedTooltip } from "@/components/ui/ThemedTooltip";

interface JoinCodeBannerProps {
  joinCode: string;
  hideCodeByDefault?: boolean;
  onCopyResult?: (result: { target: "code" | "link"; success: boolean }) => void;
}

export function JoinCodeBanner({
  joinCode,
  hideCodeByDefault = false,
  onCopyResult,
}: JoinCodeBannerProps) {
  const [isCodeVisible, setIsCodeVisible] = useState(!hideCodeByDefault);
  const normalizedJoinCode = joinCode.replace(/\s+/g, "").toUpperCase();
  const displayJoinCode = normalizedJoinCode.replace(/(.{4})(?=.)/g, "$1 ");
  const maskedJoinCode = displayJoinCode.replace(/[^\s]/g, "*");

  const copyText = async (value: string, target: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      onCopyResult?.({ target, success: true });
    } catch {
      onCopyResult?.({ target, success: false });
    }
  };

  const copyCode = () => {
    void copyText(normalizedJoinCode, "code");
  };

  const copyLink = () => {
    const inviteUrl = `${window.location.origin}/sessions/join?code=${encodeURIComponent(normalizedJoinCode)}`;
    void copyText(inviteUrl, "link");
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm">
      <span className="text-[var(--fg-subtle)]">Invite code:</span>
      <span className="group relative inline-flex">
        <button
          type="button"
          onClick={() => setIsCodeVisible((prev) => !prev)}
          aria-label={isCodeVisible ? "Hide invite code" : "Reveal invite code"}
          className="peer inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)]"
        >
          {isCodeVisible ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
        <ThemedTooltip>{isCodeVisible ? "Hide invite code" : "Reveal invite code"}</ThemedTooltip>
      </span>
      <span className="group relative inline-flex">
        <button
          type="button"
          onClick={copyCode}
          aria-label={isCodeVisible ? "Copy invite code" : "Copy hidden invite code"}
          className="peer inline-flex h-8 min-w-[10ch] cursor-pointer items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 font-mono text-sm font-semibold leading-none tracking-[0.14em] tabular-nums text-[var(--accent-primary-hover)] transition-colors hover:border-[var(--accent-primary)]/60 hover:bg-[var(--bg-soft-contrast)] hover:text-[var(--accent-primary)]"
        >
          {isCodeVisible ? (
            <span className="inline-flex items-center leading-none">{displayJoinCode}</span>
          ) : (
            <span className="inline-flex items-center text-[0.92rem] leading-none tracking-[0.16em]">
              {maskedJoinCode}
            </span>
          )}
        </button>
        <ThemedTooltip>
          {isCodeVisible ? "Copy invite code" : "Invite code hidden. Click to copy."}
        </ThemedTooltip>
      </span>
      <span className="group relative inline-flex">
        <button
          type="button"
          onClick={copyLink}
          aria-label="Copy full invite link"
          className="peer inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)]"
        >
          Copy invite link
        </button>
        <ThemedTooltip>Copy full invite link</ThemedTooltip>
      </span>
    </span>
  );
}
