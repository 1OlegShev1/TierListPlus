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
        "card-hover-lift h-full rounded-xl border border-neutral-800 bg-neutral-900 p-4",
        className,
      )}
    >
      <div className="flex h-full items-center gap-4">
        <ItemPreview items={items} variant="grid" />
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <h3
            title={title}
            className="min-h-[2.5rem] line-clamp-2 break-words text-lg font-semibold leading-tight text-neutral-100"
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
                    chip.tone === "accent" && "border-amber-500/30 text-amber-300",
                    chip.tone === "public" && "border-cyan-500/35 text-cyan-300",
                    chip.tone === "private" && "border-rose-500/35 text-rose-300",
                    chip.tone === "neutral" && "border-neutral-700 text-neutral-400",
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
              className={cn("text-sm text-neutral-500", chips.length > 0 ? "mt-3" : "mt-2.5")}
            >
              {detailsLabel}
            </p>
          )}
          {secondaryLabel && (
            <p title={secondaryLabel} className="mt-1 text-sm text-neutral-600">
              {secondaryLabel}
            </p>
          )}
          {note && <p className="mt-1 text-xs font-medium text-amber-400">{note}</p>}
        </div>
      </div>
    </div>
  );
}
