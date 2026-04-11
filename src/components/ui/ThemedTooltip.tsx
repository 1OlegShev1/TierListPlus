import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const themedTooltipBaseClassName =
  "pointer-events-none absolute left-1/2 top-[calc(100%+0.38rem)] z-30 w-max max-w-[16rem] -translate-x-1/2 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-center text-[0.72rem] leading-tight text-[var(--fg-secondary)] opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-100 group-hover:opacity-100 peer-hover:opacity-100 peer-focus-visible:opacity-100";

interface ThemedTooltipProps {
  children: ReactNode;
  className?: string;
}

export function ThemedTooltip({ children, className }: ThemedTooltipProps) {
  return (
    <span aria-hidden="true" className={cn(themedTooltipBaseClassName, className)}>
      {children}
    </span>
  );
}
