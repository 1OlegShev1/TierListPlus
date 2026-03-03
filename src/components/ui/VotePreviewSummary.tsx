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
  meta,
  items,
  chips = [],
}: {
  title: string;
  meta: string;
  items: PreviewItem[];
  chips?: VoteDisplayChip[];
}) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <ItemPreview items={items} variant="stack" />
      <div className="min-w-0">
        <h3 className="truncate text-lg font-semibold text-neutral-100">{title}</h3>
        {chips.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
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
        <p className="mt-2 text-sm text-neutral-500">{meta}</p>
      </div>
    </div>
  );
}
