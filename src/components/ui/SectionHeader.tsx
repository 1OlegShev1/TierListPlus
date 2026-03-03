import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

export function SectionHeader({
  title,
  subtitle,
  actionHref,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-semibold text-neutral-200 sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-neutral-500 sm:text-base">{subtitle}</p>}
      </div>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className={`${buttonVariants.secondary} shrink-0 self-start !rounded-xl !px-3 !py-1.5 !text-sm !font-medium`}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
