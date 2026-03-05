import { formatDate } from "@/lib/utils";

export type ListViewer = "owner" | "browser";

export interface ListDisplayChip {
  label: string;
  tone: "neutral" | "accent";
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
  const chips: ListDisplayChip[] = [
    { label: viewer === "owner" ? "Your list" : "Shared list", tone: "accent" },
    { label: accessLabel ?? (isPublic ? "Public" : "Private"), tone: "neutral" },
  ];

  return {
    chips,
    detailsLabel: `${itemCount} picks`,
    secondaryLabel: `Updated ${formatDate(updatedAt)}`,
  };
}
