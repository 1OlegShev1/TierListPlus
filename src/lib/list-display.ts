import { formatDate } from "@/lib/utils";

export type ListViewer = "owner" | "browser";

export interface ListDisplayChip {
  label: string;
  tone: "neutral" | "accent" | "public" | "private";
}

export function buildListDisplay({
  viewer,
  isPublic,
  updatedAt,
  itemCount,
  accessLabel,
}: {
  viewer: ListViewer;
  isPublic: boolean;
  updatedAt: Date | string;
  itemCount: number;
  accessLabel?: "Public" | "Private" | "Space";
}) {
  const visibilityLabel = accessLabel ?? (isPublic ? "Public" : "Private");
  const visibilityTone =
    visibilityLabel === "Public" ? "public" : visibilityLabel === "Private" ? "private" : "neutral";
  const chips: ListDisplayChip[] = [
    { label: viewer === "owner" ? "Your list" : "Shared list", tone: "accent" },
    { label: visibilityLabel, tone: visibilityTone },
  ];

  return {
    chips,
    detailsLabel: `${itemCount} picks`,
    secondaryLabel: `Updated ${formatDate(updatedAt)}`,
  };
}
