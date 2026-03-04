import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-white placeholder:text-neutral-500 focus:border-amber-500 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});
