"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/hooks/useUser";

export function IdentityRecoveryBanner() {
  const pathname = usePathname();
  const { needsRecovery } = useUser();

  if (!needsRecovery || pathname.startsWith("/devices")) return null;

  return (
    <div
      role="alert"
      className="border-b border-[var(--accent-primary)]/35 bg-[var(--accent-primary)]/10 px-3 py-2 text-sm text-[var(--accent-primary-hover)]"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <span>This browser remembers a workspace, but its secure session needs restoring.</span>
        <Link
          href="/devices"
          className="font-semibold underline underline-offset-4 hover:text-[var(--fg-primary)]"
        >
          Restore access
        </Link>
      </div>
    </div>
  );
}
