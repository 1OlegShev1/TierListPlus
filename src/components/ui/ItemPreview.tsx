import { cn } from "@/lib/utils";
import { ItemArtwork } from "./ItemArtwork";

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
        <ItemArtwork
          key={item.id}
          src={item.imageUrl}
          alt={item.label ?? ""}
          loading="lazy"
          decoding="async"
          className="aspect-square w-full rounded-lg border border-[var(--border-subtle)]"
          presentation="ambient"
          inset="compact"
        />
      ))}
      {Array.from({ length: Math.max(0, 4 - previewItems.length) }, (_, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
          key={index}
          className="aspect-square w-full rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-soft-contrast)]"
        />
      ))}
    </div>
  );
}
