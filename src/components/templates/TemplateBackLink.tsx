"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

export function TemplateBackLink({
  fallbackHref,
  label,
  className,
}: {
  fallbackHref: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();

    const referrer = document.referrer;
    let hasSameOriginReferrer = false;
    try {
      hasSameOriginReferrer = !!referrer && new URL(referrer).origin === window.location.origin;
    } catch {}

    if (hasSameOriginReferrer && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <Link href={fallbackHref} className={className} onClick={handleClick}>
      {`← ${label}`}
    </Link>
  );
}
