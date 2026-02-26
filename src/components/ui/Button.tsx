import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "rounded-lg bg-amber-500 px-6 py-2 font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-50",
  secondary:
    "rounded-lg border border-neutral-700 px-6 py-2 text-neutral-300 transition-colors hover:bg-neutral-800",
  ghost:
    "text-sm text-neutral-500 transition-colors hover:text-neutral-300",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  return (
    <button className={cn(buttonVariants[variant], className)} {...props} />
  );
}
