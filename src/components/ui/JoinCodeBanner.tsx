"use client";

import { useState } from "react";

interface JoinCodeBannerProps {
  joinCode: string;
}

export function JoinCodeBanner({ joinCode }: JoinCodeBannerProps) {
  const [copiedTarget, setCopiedTarget] = useState<"code" | "link" | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

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
    void copyText(joinCode, "code");
  };

  const copyLink = () => {
    const inviteUrl = `${window.location.origin}/sessions/join?code=${encodeURIComponent(joinCode)}`;
    void copyText(inviteUrl, "link");
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm">
      <span className="text-neutral-500">Invite code:</span>
      <button
        type="button"
        onClick={copyCode}
        title="Click to copy invite code"
        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-neutral-700 bg-neutral-950 px-2 font-mono text-sm font-semibold tracking-[0.14em] text-amber-300 transition-colors hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-200"
      >
        {joinCode}
      </button>
      <button
        type="button"
        onClick={copyLink}
        title="Copy full invite link"
        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-neutral-700 bg-neutral-950 px-3 text-xs font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:bg-neutral-900"
      >
        Copy invite link
      </button>
      {copyError ? (
        <span className="text-xs text-red-400">{copyError}</span>
      ) : copiedTarget === "link" ? (
        <span className="text-xs text-neutral-500">Invite link copied</span>
      ) : copiedTarget === "code" ? (
        <span className="text-xs text-neutral-500">Code copied</span>
      ) : (
        <span className="text-xs text-neutral-600">Share code or full link</span>
      )}
    </span>
  );
}
