"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GearIcon } from "@/components/ui/GearIcon";

const links = [
  { href: "/", label: "Home" },
  { href: "/templates", label: "Lists" },
  { href: "/sessions", label: "Votes" },
];

export function NavBar() {
  const pathname = usePathname();
  const devicesActive = pathname.startsWith("/devices");

  return (
    <nav className="border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:h-20 sm:gap-8 sm:px-6">
        <Link
          href="/"
          aria-label="TierList home"
          className="shrink-0 font-bold tracking-tight text-white sm:text-2xl"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900 text-sm sm:hidden">
            TL<span className="text-amber-400">+</span>
          </span>
          <span className="hidden sm:inline">
            TierList<span className="text-amber-400">+</span>
          </span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto sm:gap-7 sm:overflow-visible">
          {links.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-sm font-medium transition-colors sm:h-auto sm:rounded-none sm:px-0 sm:text-base ${
                  isActive
                    ? "bg-neutral-800 text-white sm:bg-transparent"
                    : "text-neutral-400 hover:bg-neutral-800/80 hover:text-white sm:hover:bg-transparent"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <Link
          href="/devices"
          aria-label="Devices"
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors sm:h-auto sm:w-auto sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 ${
            devicesActive
              ? "bg-neutral-800 text-white"
              : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
          }`}
        >
          <GearIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="hidden text-sm font-medium sm:inline">Devices</span>
        </Link>
      </div>
    </nav>
  );
}
