import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

export function SectionHeader({
  title,
  subtitle,
  actionHref,
  actionLabel,
  actions,
}: {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-semibold text-[var(--fg-primary)] sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-[var(--fg-muted)] sm:text-base">{subtitle}</p>}
      </div>
      {actions ??
        (actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className={`${buttonVariants.secondary} shrink-0 self-start !rounded-xl !px-3 !py-1.5 !text-sm !font-medium`}
          >
            {actionLabel}
          </Link>
        ) : null)}
    </div>
  );
}
