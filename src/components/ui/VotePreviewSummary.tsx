import { ItemPreview } from "@/components/ui/ItemPreview";

interface PreviewItem {
  id: string;
  imageUrl: string;
  label?: string | null;
}

export function VotePreviewSummary({
  title,
  meta,
  items,
}: {
  title: string;
  meta: string;
  items: PreviewItem[];
}) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <ItemPreview items={items} variant="stack" />
      <div className="min-w-0">
        <h3 className="truncate text-lg font-semibold text-neutral-100">{title}</h3>
        <p className="mt-1 text-sm text-neutral-500">{meta}</p>
      </div>
    </div>
  );
}
