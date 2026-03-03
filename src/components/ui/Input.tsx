import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-white placeholder:text-neutral-500 focus:border-amber-500 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
