import { ItemPreview } from "@/components/ui/ItemPreview";
import { cn } from "@/lib/utils";
import type { VoteDisplayChip } from "@/lib/vote-display";

interface PreviewItem {
  id: string;
  imageUrl: string;
  label?: string | null;
}

export function VotePreviewSummary({
  title,
  detailsLabel,
  secondaryLabel,
  items,
  chips = [],
  sourceLabel,
}: {
  title: string;
  detailsLabel?: string | null;
  secondaryLabel?: string | null;
  items: PreviewItem[];
  chips?: VoteDisplayChip[];
  sourceLabel?: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-4">
      <ItemPreview items={items} variant="stack" className="w-16 gap-1.5 sm:w-20" />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <h3
          title={title}
          className="line-clamp-2 break-words text-lg font-semibold leading-tight text-[var(--fg-primary)]"
        >
          {title}
        </h3>
        {chips.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <span
                key={`${chip.tone}-${chip.label}`}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[0.68rem] font-medium uppercase tracking-[0.08em]",
                  chip.tone === "accent" &&
                    "border-[var(--accent-primary)]/35 text-[var(--accent-primary-hover)]",
                  chip.tone === "success" &&
                    "border-[var(--state-success-fg)]/35 text-[var(--state-success-fg)]",
                  chip.tone === "public" &&
                    "border-[var(--source-control-linked-border)] text-[var(--source-control-linked-fg)]",
                  chip.tone === "private" &&
                    "border-[var(--state-danger-fg)]/35 text-[var(--state-danger-fg)]",
                  chip.tone === "space" &&
                    "border-[var(--state-muted-fg)]/35 text-[var(--state-muted-fg)]",
                  chip.tone === "warning" &&
                    "border-[var(--state-danger-fg)]/35 text-[var(--state-danger-fg)]",
                  chip.tone === "neutral" &&
                    "border-[var(--border-default)] text-[var(--fg-muted)]",
                )}
              >
                {chip.label}
              </span>
            ))}
          </div>
        )}
        {sourceLabel && (
          <p
            title={sourceLabel}
            className={cn(
              "line-clamp-2 break-words text-sm leading-snug text-[var(--fg-muted)]",
              chips.length > 0 ? "mt-3" : "mt-2.5",
            )}
          >
            {sourceLabel}
          </p>
        )}
        {(detailsLabel || secondaryLabel) && (
          <div
            className={cn(
              "flex flex-wrap items-baseline gap-x-4 gap-y-1.5 text-sm",
              sourceLabel ? "mt-2" : chips.length > 0 ? "mt-3" : "mt-2.5",
            )}
          >
            {detailsLabel && (
              <p title={detailsLabel} className="break-words text-[var(--fg-subtle)]">
                {detailsLabel}
              </p>
            )}
            {secondaryLabel && (
              <p title={secondaryLabel} className="whitespace-nowrap text-[var(--fg-subtle)]">
                {secondaryLabel}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
