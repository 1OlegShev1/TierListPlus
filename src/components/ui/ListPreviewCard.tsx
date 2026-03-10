import { ItemPreview } from "@/components/ui/ItemPreview";
import type { ListDisplayChip } from "@/lib/list-display";
import { cn } from "@/lib/utils";

interface PreviewItem {
  id: string;
  imageUrl: string;
  label?: string | null;
}

export function ListPreviewCard({
  title,
  detailsLabel,
  secondaryLabel,
  items,
  chips = [],
  note,
  className,
}: {
  title: string;
  detailsLabel?: string | null;
  secondaryLabel?: string | null;
  items: PreviewItem[];
  chips?: ListDisplayChip[];
  note?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "card-hover-lift h-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4",
        className,
      )}
    >
      <div className="flex h-full items-center gap-4">
        <ItemPreview items={items} variant="grid" />
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <h3
            title={title}
            className="min-h-[2.5rem] line-clamp-2 break-words text-lg font-semibold leading-tight text-[var(--fg-primary)]"
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
                    chip.tone === "public" &&
                      "border-[var(--state-muted-fg)]/35 text-[var(--state-muted-fg)]",
                    chip.tone === "private" &&
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
          {detailsLabel && (
            <p
              title={detailsLabel}
              className={cn(
                "text-sm text-[var(--fg-subtle)]",
                chips.length > 0 ? "mt-3" : "mt-2.5",
              )}
            >
              {detailsLabel}
            </p>
          )}
          {secondaryLabel && (
            <p title={secondaryLabel} className="mt-1 text-sm text-[var(--fg-subtle)]">
              {secondaryLabel}
            </p>
          )}
          {note && <p className="mt-1 text-xs font-medium text-[var(--accent-primary)]">{note}</p>}
        </div>
      </div>
    </div>
  );
}
