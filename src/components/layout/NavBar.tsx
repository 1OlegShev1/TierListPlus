"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/templates", label: "Templates" },
  { href: "/sessions", label: "Sessions" },
  { href: "/sessions/join", label: "Join" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-neutral-800 bg-neutral-950">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:h-16 sm:gap-8 sm:px-4">
        <Link
          href="/"
          aria-label="TierList home"
          className="shrink-0 font-bold text-white sm:text-xl"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 text-xs sm:hidden">
            TL<span className="text-amber-400">+</span>
          </span>
          <span className="hidden sm:inline">
            TierList<span className="text-amber-400">+</span>
          </span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:gap-6 sm:overflow-visible">
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);
            const isJoinCta = link.href === "/sessions/join";

            if (isJoinCta) {
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-semibold leading-none text-black transition-colors sm:ml-2 sm:h-9 sm:px-4 sm:text-base ${
                    isActive ? "bg-amber-400" : "bg-amber-500 hover:bg-amber-400"
                  }`}
                >
                  {link.label}
                </Link>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex h-8 shrink-0 items-center rounded-md px-2.5 text-sm transition-colors sm:h-auto sm:rounded-none sm:px-0 sm:text-base ${
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
      </div>
    </nav>
  );
}
