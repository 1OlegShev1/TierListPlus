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
        className="font-mono font-bold tracking-wider text-amber-400 transition-colors hover:text-amber-300"
      >
        {joinCode}
      </button>
      {copied && <span className="text-xs text-neutral-600">Copied!</span>}
    </span>
  );
}
