import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-white focus:border-amber-500 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
