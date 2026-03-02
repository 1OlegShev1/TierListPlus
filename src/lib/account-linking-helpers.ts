import type { Participant } from "@prisma/client";

export function pickParticipantSurvivor(
  participants: Participant[],
  preferredUserId: string,
): Participant {
  const preferred = participants
    .filter((participant) => participant.userId === preferredUserId)
    .sort((a, b) => {
      if (!!a.submittedAt !== !!b.submittedAt) {
        return a.submittedAt ? -1 : 1;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

  if (preferred.length > 0) {
    return preferred[0];
  }

  return participants.slice().sort((a, b) => {
    if (!!a.submittedAt !== !!b.submittedAt) {
      return a.submittedAt ? -1 : 1;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];
}
