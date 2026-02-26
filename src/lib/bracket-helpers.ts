import { prisma } from "@/lib/prisma";

/** Advance a matchup winner to the next round slot in the database */
export async function advanceWinnerToNextRound(
  bracketId: string,
  matchupPosition: number,
  winnerId: string,
  currentRound: number,
  totalRounds: number,
) {
  if (currentRound >= totalRounds) return;

  const nextRound = currentRound + 1;
  const nextPosition = Math.floor(matchupPosition / 2);
  const slot = matchupPosition % 2 === 0 ? "itemAId" : "itemBId";

  await prisma.bracketMatchup.updateMany({
    where: { bracketId, round: nextRound, position: nextPosition },
    data: { [slot]: winnerId },
  });
}
