import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "accent" | "ghost";
type ButtonSize = "default" | "equalAction";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "inline-flex items-center justify-center rounded-lg bg-[var(--action-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--action-primary-fg)] transition-colors hover:bg-[var(--action-primary-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50 sm:px-8 sm:py-2.5 sm:text-base",
  secondary:
    "inline-flex items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--fg-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--action-secondary-bg-hover)] hover:text-[var(--fg-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:px-8 sm:py-2.5 sm:text-base",
  accent:
    "inline-flex items-center justify-center rounded-lg border border-[var(--accent-primary)]/60 bg-[var(--accent-primary)]/10 px-4 py-2 text-sm font-medium text-[var(--accent-primary-hover)] transition-colors hover:border-[var(--accent-primary-hover)] hover:bg-[var(--accent-primary)]/15 hover:text-[var(--fg-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:px-8 sm:py-2.5 sm:text-base",
  ghost:
    "text-sm text-[var(--fg-muted)] transition-colors hover:text-[var(--fg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
};

export const buttonSizes: Record<ButtonSize, string> = {
  default: "",
  equalAction: "!h-10 !justify-center !px-4 !py-0 !text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "default", className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn("cursor-pointer", buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    />
  );
});
