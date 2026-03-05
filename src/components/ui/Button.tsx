import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "default" | "equalAction";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-50 sm:px-8 sm:py-2.5 sm:text-base",
  secondary:
    "inline-flex items-center justify-center rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 sm:px-8 sm:py-2.5 sm:text-base",
  ghost: "text-sm text-neutral-500 transition-colors hover:text-neutral-300",
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
