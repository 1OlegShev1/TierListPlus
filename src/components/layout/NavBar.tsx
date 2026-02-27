"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/templates", label: "Templates" },
  { href: "/sessions", label: "Sessions" },
  { href: "/sessions/join", label: "Join" },
];

export function NavBar() {
  const pathname = usePathname();
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const isHiddenRef = useRef(false);
  const shouldAutoHide =
    (isNarrowScreen || isCoarsePointer) && /^\/sessions\/[^/]+\/(vote|results)$/.test(pathname);

  useEffect(() => {
    const narrowMedia = window.matchMedia("(max-width: 767px)");
    const pointerMedia = window.matchMedia("(pointer: coarse)");
    const update = () => {
      setIsNarrowScreen(narrowMedia.matches);
      setIsCoarsePointer(pointerMedia.matches);
    };
    update();
    narrowMedia.addEventListener("change", update);
    pointerMedia.addEventListener("change", update);
    return () => {
      narrowMedia.removeEventListener("change", update);
      pointerMedia.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (pathname) setIsHidden(false);
    isHiddenRef.current = false;
  }, [pathname]);

  useEffect(() => {
    if (!shouldAutoHide) {
      setIsHidden(false);
      isHiddenRef.current = false;
      return;
    }

    const TOP_SHOW_THRESHOLD = 10;
    const HIDE_SCROLL_DELTA = 12;
    const SHOW_SCROLL_DISTANCE = 72;
    const JITTER_DELTA = 3;

    let activeTarget: EventTarget | null = null;
    let lastTop = 0;
    let hiddenAt = 0;
    let touchStartY: number | null = null;

    const isInsideNav = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest("[data-nav-shell='true']");

    const readTop = (target: EventTarget | null) => {
      if (target instanceof HTMLElement) return target.scrollTop;
      if (target === document || target === document.documentElement || target === document.body) {
        const main = document.querySelector("main");
        return main?.scrollTop ?? window.scrollY;
      }
      return null;
    };

    const onScroll = (e: Event) => {
      const target = e.target;
      if (isInsideNav(target)) return;

      const currentTop = readTop(target);
      if (currentTop == null) return;

      if (currentTop <= TOP_SHOW_THRESHOLD) {
        if (isHiddenRef.current) {
          setIsHidden(false);
          isHiddenRef.current = false;
        }
        lastTop = currentTop;
        hiddenAt = currentTop;
        activeTarget = target;
        return;
      }

      if (activeTarget !== target) {
        activeTarget = target;
        lastTop = currentTop;
        hiddenAt = currentTop;
        return;
      }

      const delta = currentTop - lastTop;
      const absDelta = Math.abs(delta);

      if (absDelta <= JITTER_DELTA) {
        lastTop = currentTop;
        return;
      }

      if (!isHiddenRef.current) {
        if (delta > HIDE_SCROLL_DELTA) {
          setIsHidden(true);
          isHiddenRef.current = true;
          hiddenAt = currentTop;
        }
      } else {
        if (delta > 0) {
          hiddenAt = Math.max(hiddenAt, currentTop);
        }

        const upwardDistance = hiddenAt - currentTop;
        if (upwardDistance >= SHOW_SCROLL_DISTANCE) {
          setIsHidden(false);
          isHiddenRef.current = false;
        }
      }

      lastTop = currentTop;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (isInsideNav(e.target)) return;
      touchStartY = e.touches[0]?.clientY ?? null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isInsideNav(e.target)) return;
      if (touchStartY == null) return;
      const currentY = e.touches[0]?.clientY;
      if (currentY == null) return;

      const delta = touchStartY - currentY;
      if (Math.abs(delta) < 18) return;

      if (delta > 0 && !isHiddenRef.current) {
        setIsHidden(true);
        isHiddenRef.current = true;
      } else if (delta < 0 && isHiddenRef.current) {
        setIsHidden(false);
        isHiddenRef.current = false;
      }

      touchStartY = currentY;
    };

    const onTouchEnd = () => {
      touchStartY = null;
    };

    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [shouldAutoHide]);

  return (
    <div
      data-nav-shell="true"
      className={`overflow-hidden border-b border-neutral-800 transition-[max-height,opacity,transform] duration-200 ease-out ${
        shouldAutoHide && isHidden
          ? "max-h-0 -translate-y-1 opacity-0"
          : "max-h-14 translate-y-0 opacity-100 sm:max-h-16"
      }`}
    >
      <nav className="bg-neutral-950">
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
    </div>
  );
}
