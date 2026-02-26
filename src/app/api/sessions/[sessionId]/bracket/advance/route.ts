import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const bracket = await prisma.bracket.findFirst({
    where: { sessionId },
    include: {
      matchups: {
        include: { votes: true },
        orderBy: [{ round: "asc" }, { position: "asc" }],
      },
    },
  });

  if (!bracket) {
    return NextResponse.json({ error: "No bracket found" }, { status: 404 });
  }

  // Find the current active round (first round with undecided matchups that have both items)
  let currentRound = 0;
  for (let r = 1; r <= bracket.rounds; r++) {
    const roundMatchups = bracket.matchups.filter((m) => m.round === r);
    const hasUndecided = roundMatchups.some(
      (m) => m.itemAId && m.itemBId && !m.winnerId
    );
    if (hasUndecided) {
      currentRound = r;
      break;
    }
  }

  if (currentRound === 0) {
    return NextResponse.json({ message: "Bracket is already complete" });
  }

  const roundMatchups = bracket.matchups.filter(
    (m) => m.round === currentRound
  );

  // Tally votes and determine winners
  for (const matchup of roundMatchups) {
    if (matchup.winnerId || !matchup.itemAId || !matchup.itemBId) continue;

    const votesForA = matchup.votes.filter(
      (v) => v.chosenItemId === matchup.itemAId
    ).length;
    const votesForB = matchup.votes.filter(
      (v) => v.chosenItemId === matchup.itemBId
    ).length;

    // Winner by majority; ties broken by random
    let winnerId: string;
    if (votesForA > votesForB) {
      winnerId = matchup.itemAId;
    } else if (votesForB > votesForA) {
      winnerId = matchup.itemBId;
    } else {
      winnerId = Math.random() < 0.5 ? matchup.itemAId : matchup.itemBId;
    }

    // Update winner
    await prisma.bracketMatchup.update({
      where: { id: matchup.id },
      data: { winnerId },
    });

    // Advance winner to next round
    if (currentRound < bracket.rounds) {
      const nextRound = currentRound + 1;
      const nextPosition = Math.floor(matchup.position / 2);
      const slot = matchup.position % 2 === 0 ? "itemAId" : "itemBId";

      await prisma.bracketMatchup.updateMany({
        where: {
          bracketId: bracket.id,
          round: nextRound,
          position: nextPosition,
        },
        data: { [slot]: winnerId },
      });
    }
  }

  // Fetch updated bracket
  const updated = await prisma.bracket.findFirst({
    where: { sessionId },
    include: {
      matchups: {
        include: {
          itemA: { select: { id: true, label: true, imageUrl: true } },
          itemB: { select: { id: true, label: true, imageUrl: true } },
          winner: { select: { id: true, label: true, imageUrl: true } },
          votes: { select: { participantId: true, chosenItemId: true } },
        },
        orderBy: [{ round: "asc" }, { position: "asc" }],
      },
    },
  });

  return NextResponse.json(updated);
}
