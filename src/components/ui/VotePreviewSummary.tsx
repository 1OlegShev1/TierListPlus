import { ItemPreview } from "@/components/ui/ItemPreview";
import { splitUpdatedMeta } from "@/lib/display-meta";
import { cn } from "@/lib/utils";
import type { VoteDisplayChip } from "@/lib/vote-display";

interface PreviewItem {
  id: string;
  imageUrl: string;
  label?: string | null;
}

export function VotePreviewSummary({
  title,
  meta,
  items,
  chips = [],
  sourceLabel,
}: {
  title: string;
  meta: string;
  items: PreviewItem[];
  chips?: VoteDisplayChip[];
  sourceLabel?: string | null;
}) {
  const metaDisplay = splitUpdatedMeta(meta);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-4">
      <ItemPreview items={items} variant="stack" className="w-16 gap-1.5 sm:w-20" />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <h3
          title={title}
          className="line-clamp-2 break-words text-lg font-semibold leading-tight text-neutral-100"
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
                  chip.tone === "success" && "border-emerald-500/30 text-emerald-300",
                  chip.tone === "warning" && "border-red-500/30 text-red-300",
                  chip.tone === "neutral" && "border-neutral-700 text-neutral-400",
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
              "line-clamp-2 break-words text-sm leading-snug text-neutral-400",
              chips.length > 0 ? "mt-3" : "mt-2.5",
            )}
          >
            {sourceLabel}
          </p>
        )}
        {(metaDisplay.details || metaDisplay.updated) && (
          <div
            className={cn(
              "flex flex-wrap items-baseline gap-x-4 gap-y-1.5 text-sm",
              sourceLabel ? "mt-2" : chips.length > 0 ? "mt-3" : "mt-2.5",
            )}
          >
            {metaDisplay.details && (
              <p title={metaDisplay.details} className="whitespace-nowrap text-neutral-500">
                {metaDisplay.details}
              </p>
            )}
            {metaDisplay.updated && (
              <p title={metaDisplay.updated} className="whitespace-nowrap text-neutral-600">
                {metaDisplay.updated}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
