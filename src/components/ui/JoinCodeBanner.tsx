"use client";

import { useState } from "react";
import { EyeIcon, EyeSlashIcon } from "@/components/ui/icons";

interface JoinCodeBannerProps {
  joinCode: string;
  hideCodeByDefault?: boolean;
}

export function JoinCodeBanner({ joinCode, hideCodeByDefault = false }: JoinCodeBannerProps) {
  const [copiedTarget, setCopiedTarget] = useState<"code" | "link" | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [isCodeVisible, setIsCodeVisible] = useState(!hideCodeByDefault);
  const normalizedJoinCode = joinCode.replace(/\s+/g, "").toUpperCase();
  const displayJoinCode = normalizedJoinCode.replace(/(.{4})(?=.)/g, "$1 ");
  const maskedJoinCode = displayJoinCode.replace(/[^\s]/g, "*");

  const copyText = async (value: string, target: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyError(null);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch {
      setCopiedTarget(null);
      setCopyError("Copy failed");
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
      <button
        type="button"
        onClick={() => setIsCodeVisible((prev) => !prev)}
        aria-label={isCodeVisible ? "Hide invite code" : "Reveal invite code"}
        title={isCodeVisible ? "Hide invite code" : "Reveal invite code"}
        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)]"
      >
        {isCodeVisible ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={copyCode}
        title={isCodeVisible ? "Click to copy invite code" : "Invite code hidden. Click to copy."}
        className="inline-flex h-8 min-w-[10ch] cursor-pointer items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 font-mono text-sm font-semibold tracking-[0.14em] tabular-nums text-[var(--accent-primary-hover)] transition-colors hover:border-[var(--accent-primary)]/60 hover:bg-[var(--bg-soft-contrast)] hover:text-[var(--accent-primary)]"
      >
        {isCodeVisible ? displayJoinCode : maskedJoinCode}
      </button>
      <button
        type="button"
        onClick={copyLink}
        title="Copy full invite link"
        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)]"
      >
        Copy invite link
      </button>
      {copyError ? (
        <span className="text-xs text-[var(--state-danger-fg)]">{copyError}</span>
      ) : copiedTarget === "link" ? (
        <span className="text-xs text-[var(--fg-subtle)]">Invite link copied</span>
      ) : copiedTarget === "code" ? (
        <span className="text-xs text-[var(--fg-subtle)]">Code copied</span>
      ) : (
        <span className="text-xs text-[var(--fg-muted)]">Share code or full link</span>
      )}
    </span>
  );
}
