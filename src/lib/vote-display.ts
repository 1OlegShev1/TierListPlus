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
}) {
  const chips: VoteDisplayChip[] = [];

  if (viewer === "owner") {
    chips.push({ label: "Your vote", tone: "accent" });
  } else if (viewer === "participant") {
    chips.push({ label: "You joined", tone: "accent" });
  }

  chips.push({ label: isPrivate ? "Private" : "Public", tone: "neutral" });

  if (status === "OPEN") {
    chips.push({
      label: isLocked ? "Locked" : "Open to join",
      tone: isLocked ? "warning" : "success",
    });
  }

  const sourceLabel = listHidden ? null : listName;
  const metaParts = [
    `${itemCount} picks`,
    `${participantCount} joined`,
    `Updated ${formatDate(updatedAt)}`,
  ];

  return {
    chips,
    sourceLabel,
    meta: metaParts.join(" · "),
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
