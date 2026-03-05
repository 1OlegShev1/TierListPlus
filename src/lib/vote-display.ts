import { formatDate } from "@/lib/utils";

export type VoteViewer = "owner" | "participant" | "browser";

export interface VoteDisplayChip {
  label: string;
  tone: "neutral" | "accent" | "success" | "warning";
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
}) {
  const chips: VoteDisplayChip[] = [];

  if (viewer === "owner") {
    chips.push({ label: "Your vote", tone: "accent" });
  } else if (viewer === "participant") {
    chips.push({ label: "You joined", tone: "accent" });
  }

  const visibilityLabel = spaceVisibility
    ? spaceVisibility === "OPEN"
      ? "Open space"
      : "Private space"
    : isPrivate
      ? "Private"
      : "Public";
  chips.push({ label: visibilityLabel, tone: "neutral" });

  if (status === "OPEN") {
    chips.push({
      label: isLocked ? "Locked" : "Open to join",
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

  return { label: "Continue", href: `/sessions/${sessionId}` };
}
