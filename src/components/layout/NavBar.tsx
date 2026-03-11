"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { GearIcon } from "@/components/ui/GearIcon";

const BASE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/spaces", label: "Spaces" },
  { href: "/templates", label: "Lists" },
  { href: "/sessions", label: "Votes" },
] as const;

export function NavBar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const devicesActive = pathname.startsWith("/devices");
  const [resolvedIsAdmin, setResolvedIsAdmin] = useState(isAdmin ?? false);

  useEffect(() => {
    setResolvedIsAdmin(isAdmin ?? false);
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin !== undefined) return;

    let cancelled = false;
    const controller = new AbortController();

    void fetch("/api/users/session", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { role?: string };
        if (!cancelled && data.role === "ADMIN") {
          setResolvedIsAdmin(true);
        }
      })
      .catch(() => {
        // Best-effort UI affordance only.
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isAdmin]);

  const links = resolvedIsAdmin ? [...BASE_LINKS, { href: "/admin", label: "Admin" }] : BASE_LINKS;

  return (
    <nav className="border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-1 px-3 sm:gap-8 sm:px-5">
        <Link
          href="/"
          aria-label="TierList home"
          className="shrink-0 font-bold text-[var(--fg-primary)] sm:text-[1.7rem]"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-sm sm:hidden">
            TL<span className="text-[var(--accent-primary)]">+</span>
          </span>
          <span className="hidden sm:inline">
            TierList<span className="text-[var(--accent-primary)]">+</span>
          </span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:gap-4 sm:overflow-visible">
          {links.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex h-11 shrink-0 items-center rounded-lg border px-3 text-[0.95rem] font-medium transition-colors sm:px-4.5 sm:text-[1.05rem] ${
                  isActive
                    ? "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-primary)]"
                    : "border-transparent text-[var(--fg-muted)] hover:border-[var(--border-default)] hover:bg-[var(--bg-surface)] hover:text-[var(--fg-primary)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <div className="shrink-0 lg:hidden">
          <ThemeSwitcher variant="cycle" />
        </div>
        <div className="hidden shrink-0 lg:block">
          <ThemeSwitcher compact />
        </div>
        <Link
          href="/devices"
          aria-label="Devices"
          className={`inline-flex h-11 w-9 shrink-0 items-center justify-center border border-transparent p-0 text-[var(--fg-muted)] transition-colors sm:h-11 sm:w-auto sm:gap-2.5 sm:rounded-lg sm:px-4.5 sm:py-2.5 ${
            devicesActive
              ? "text-[var(--fg-primary)] sm:border-[var(--border-default)] sm:bg-[var(--bg-surface)]"
              : "hover:text-[var(--fg-primary)] sm:hover:border-[var(--border-default)] sm:hover:bg-[var(--bg-surface)]"
          }`}
        >
          <GearIcon className="h-[1.375rem] w-[1.375rem]" />
          <span className="hidden text-[0.95rem] font-medium sm:inline">Devices</span>
        </Link>
      </div>
    </nav>
  );
}
