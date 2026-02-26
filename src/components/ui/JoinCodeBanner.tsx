"use client";

import { useState } from "react";

interface JoinCodeBannerProps {
  joinCode: string;
}

export function JoinCodeBanner({ joinCode }: JoinCodeBannerProps) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="text-neutral-500">Code:</span>
      <button
        type="button"
        onClick={copy}
        title="Click to copy"
        className="cursor-pointer rounded px-1.5 py-0.5 font-mono font-bold tracking-wider text-amber-400 transition-colors hover:bg-amber-400/10 hover:text-amber-300"
      >
        {joinCode}
      </button>
      {copied && <span className="text-xs text-neutral-500">Copied!</span>}
    </span>
  );
}
