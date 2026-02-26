"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/templates", label: "Templates" },
  { href: "/sessions", label: "Sessions" },
  { href: "/sessions/join", label: "Join" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-neutral-800 bg-neutral-950">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="text-lg font-bold text-white">
          TierList<span className="text-amber-400">+</span>
        </Link>
        <div className="flex gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                pathname.startsWith(link.href)
                  ? "text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
