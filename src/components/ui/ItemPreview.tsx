import { cn } from "@/lib/utils";

interface PreviewItem {
  id: string;
  imageUrl: string;
  label?: string | null;
}

export function ItemPreview({
  items,
  variant = "grid",
  className,
}: {
  items: PreviewItem[];
  variant?: "grid" | "stack";
  className?: string;
}) {
  const previewItems = items.slice(0, 4);
  const variantClasses =
    variant === "stack"
      ? "grid w-14 shrink-0 grid-cols-2 gap-1 sm:w-16"
      : "grid w-24 shrink-0 grid-cols-2 gap-1.5 sm:w-28";

  return (
    <div className={cn(variantClasses, className)}>
      {previewItems.map((item) => (
        <img
          key={item.id}
          src={item.imageUrl}
          alt={item.label ?? ""}
          className="aspect-square w-full rounded-lg border border-neutral-800/80 object-cover"
        />
      ))}
      {Array.from({ length: Math.max(0, 4 - previewItems.length) }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
          key={index}
          className="aspect-square w-full rounded-lg border border-dashed border-neutral-800 bg-neutral-900/80"
        />
      ))}
    </div>
  );
}
