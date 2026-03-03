import { ItemPreview } from "@/components/ui/ItemPreview";
import { cn } from "@/lib/utils";

interface PreviewItem {
  id: string;
  imageUrl: string;
  label?: string | null;
}

export function ListPreviewCard({
  title,
  meta,
  items,
  note,
  className,
}: {
  title: string;
  meta: string;
  items: PreviewItem[];
  note?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-neutral-800 bg-neutral-900 p-4", className)}>
      <div className="flex items-start gap-4">
        <ItemPreview items={items} variant="grid" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-neutral-100">{title}</h3>
          <p className="mt-1 text-sm text-neutral-500">{meta}</p>
          {note && <p className="mt-1 text-xs font-medium text-amber-400">{note}</p>}
        </div>
      </div>
    </div>
  );
}
