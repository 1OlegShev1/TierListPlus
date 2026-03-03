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
}: {
  viewer: ListViewer;
  isPublic: boolean;
  updatedAt: Date | string;
  itemCount: number;
}) {
  const chips: ListDisplayChip[] = [
    { label: viewer === "owner" ? "Your list" : "Shared list", tone: "accent" },
    { label: isPublic ? "Public" : "Private", tone: "neutral" },
  ];

  return {
    chips,
    detailsLabel: `${itemCount} picks`,
    secondaryLabel: `Updated ${formatDate(updatedAt)}`,
  };
}
