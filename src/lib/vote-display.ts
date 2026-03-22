import { formatDate } from "@/lib/utils";

export type VoteViewer = "owner" | "participant" | "browser";

export interface VoteDisplayChip {
  label: string;
  shortLabel?: string;
  tone: "neutral" | "accent" | "success" | "warning" | "public" | "private" | "space";
}

export function buildVoteDisplay({
  viewer,
  isPrivate,
  isLocked,
  status,
  updatedAt,
  itemCount,
  participantCount,
  listName,
  listHidden,
  spaceVisibility,
  accessLabel,
}: {
  viewer: VoteViewer;
  isPrivate: boolean;
  isLocked: boolean;
  status: string;
  updatedAt: Date | string;
  itemCount: number;
  participantCount: number;
  listName: string;
  listHidden: boolean;
  spaceVisibility?: "OPEN" | "PRIVATE";
  accessLabel?: "Public" | "Private" | "Open space" | "Private space" | "Space";
}) {
  const chips: VoteDisplayChip[] = [];

  if (viewer === "owner") {
    chips.push({ label: "Your vote", shortLabel: "Yours", tone: "accent" });
  } else if (viewer === "participant") {
    chips.push({ label: "You joined", shortLabel: "Joined", tone: "accent" });
  }

  const visibilityLabel =
    accessLabel ??
    (spaceVisibility
      ? spaceVisibility === "OPEN"
        ? "Open space"
        : "Private space"
      : isPrivate
        ? "Private"
        : "Public");
  const visibilityTone =
    visibilityLabel === "Space" ||
    visibilityLabel === "Open space" ||
    visibilityLabel === "Private space"
      ? "space"
      : visibilityLabel === "Public"
        ? "public"
        : visibilityLabel === "Private"
          ? "private"
          : "neutral";
  chips.push({
    label: visibilityLabel,
    shortLabel:
      visibilityLabel === "Public"
        ? "Pub"
        : visibilityLabel === "Private"
          ? "Priv"
          : visibilityLabel === "Open space" || visibilityLabel === "Private space"
            ? "Space"
            : visibilityLabel,
    tone: visibilityTone,
  });

  if (status === "OPEN") {
    chips.push({
      label: isLocked ? "Locked" : "Open to join",
      shortLabel: isLocked ? "Locked" : "Open",
      tone: isLocked ? "warning" : "success",
    });
  }

  const sourceLabel = listHidden ? null : listName;

  return {
    chips,
    sourceLabel,
    detailsLabel: `${itemCount} picks · ${participantCount} joined`,
    secondaryLabel: `Updated ${formatDate(updatedAt)}`,
  };
}

export function getVoteAction({
  viewer,
  status,
  isPrivate,
  isLocked,
  sessionId,
}: {
  viewer: VoteViewer;
  status: string;
  isPrivate: boolean;
  isLocked: boolean;
  sessionId: string;
}) {
  if (status !== "OPEN") {
    return { label: "Results", href: `/sessions/${sessionId}/results` };
  }

  if (viewer === "browser") {
    if (!isPrivate && !isLocked) {
      return { label: "Join", href: `/sessions/${sessionId}` };
    }

    return { label: "View", href: `/sessions/${sessionId}` };
  }

  return { label: "Resume", href: `/sessions/${sessionId}` };
}
