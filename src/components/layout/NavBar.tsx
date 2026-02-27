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
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4">
        <Link href="/" className="text-xl font-bold text-white">
          TierList<span className="text-amber-400">+</span>
        </Link>
        <div className="flex items-center gap-6">
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);
            const isJoinCta = link.href === "/sessions/join";

            if (isJoinCta) {
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`ml-2 inline-flex h-9 items-center justify-center rounded-lg px-4 text-base font-semibold leading-none text-black transition-colors ${
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
                className={`inline-flex h-9 items-center text-base transition-colors ${
                  isActive ? "text-white" : "text-neutral-400 hover:text-white"
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
