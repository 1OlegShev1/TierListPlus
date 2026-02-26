import { NextResponse } from "next/server";
import {
  ApiError,
  bracketMatchupInclude,
  notFound,
  requireOpenSession,
  withHandler,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const POST = withHandler(async (_request, { params }) => {
  const { sessionId } = await params;
  await requireOpenSession(sessionId);

  // Read bracket and tally inside a single transaction to prevent concurrent double-advance
  await prisma.$transaction(async (tx) => {
    const bracket = await tx.bracket.findFirst({
      where: { sessionId },
      include: {
        matchups: {
          include: { votes: true },
          orderBy: [{ round: "asc" }, { position: "asc" }],
        },
      },
    });

    if (!bracket) notFound("No bracket found");

    // Find the current active round (first round with undecided matchups that have both items)
    let currentRound = 0;
    for (let r = 1; r <= bracket.rounds; r++) {
      const roundMatchups = bracket.matchups.filter((m) => m.round === r);
      const hasUndecided = roundMatchups.some((m) => m.itemAId && m.itemBId && !m.winnerId);
      if (hasUndecided) {
        currentRound = r;
        break;
      }
    }

    if (currentRound === 0) {
      throw new ApiError(409, "Bracket is already complete");
    }

    const roundMatchups = bracket.matchups.filter((m) => m.round === currentRound);

    for (const matchup of roundMatchups) {
      if (matchup.winnerId || !matchup.itemAId || !matchup.itemBId) continue;

      const votesForA = matchup.votes.filter((v) => v.chosenItemId === matchup.itemAId).length;
      const votesForB = matchup.votes.filter((v) => v.chosenItemId === matchup.itemBId).length;

      // Winner by majority; ties broken by random
      let winnerId: string;
      if (votesForA > votesForB) {
        winnerId = matchup.itemAId;
      } else if (votesForB > votesForA) {
        winnerId = matchup.itemBId;
      } else {
        winnerId = Math.random() < 0.5 ? matchup.itemAId : matchup.itemBId;
      }

      // Atomic conditional update — only sets winnerId if still null,
      // so a concurrent request that already decided this matchup is safely skipped
      const { count } = await tx.bracketMatchup.updateMany({
        where: { id: matchup.id, winnerId: null },
        data: { winnerId },
      });
      if (count === 0) continue;

      // Advance winner to next round
      if (currentRound < bracket.rounds) {
        const nextRound = currentRound + 1;
        const nextPosition = Math.floor(matchup.position / 2);
        const slot = matchup.position % 2 === 0 ? "itemAId" : "itemBId";

        await tx.bracketMatchup.updateMany({
          where: { bracketId: bracket.id, round: nextRound, position: nextPosition },
          data: { [slot]: winnerId },
        });
      }
    }
  });

  // Fetch updated bracket with full includes
  const updated = await prisma.bracket.findFirst({
    where: { sessionId },
    include: {
      matchups: {
        include: bracketMatchupInclude,
        orderBy: [{ round: "asc" }, { position: "asc" }],
      },
    },
  });

  return NextResponse.json(updated);
});
