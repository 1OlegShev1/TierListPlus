import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateBracket } from "@/lib/bracket-generator";
import { notFound, badRequest, bracketMatchupInclude } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const bracket = await prisma.bracket.findFirst({
    where: { sessionId },
    include: {
      matchups: {
        include: bracketMatchupInclude,
        orderBy: [{ round: "asc" }, { position: "asc" }],
      },
    },
  });

  if (!bracket) return notFound("No bracket found");

  return NextResponse.json(bracket);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // Check if bracket already exists
  const existing = await prisma.bracket.findFirst({ where: { sessionId } });
  if (existing) return badRequest("Bracket already exists");

  const items = await prisma.sessionItem.findMany({
    where: { sessionId },
    orderBy: { sortOrder: "asc" },
  });

  if (items.length < 2) return badRequest("Need at least 2 items for a bracket");

  const { rounds, matchups } = generateBracket(items.map((i) => i.id));

  const bracket = await prisma.bracket.create({
    data: {
      sessionId,
      rounds,
      matchups: {
        create: matchups.map((m) => ({
          round: m.round,
          position: m.position,
          itemAId: m.itemAId,
          itemBId: m.itemBId,
          // Auto-advance byes (matchups with only one item)
          winnerId:
            m.itemAId && !m.itemBId
              ? m.itemAId
              : !m.itemAId && m.itemBId
              ? m.itemBId
              : null,
        })),
      },
    },
    include: {
      matchups: {
        include: bracketMatchupInclude,
        orderBy: [{ round: "asc" }, { position: "asc" }],
      },
    },
  });

  // Auto-advance bye winners to next round
  await advanceByes(bracket.id, rounds);

  return NextResponse.json(bracket, { status: 201 });
}

async function advanceByes(bracketId: string, totalRounds: number) {
  const matchups = await prisma.bracketMatchup.findMany({
    where: { bracketId, round: 1 },
    orderBy: { position: "asc" },
  });

  for (const matchup of matchups) {
    if (matchup.winnerId && totalRounds > 1) {
      // Place winner in next round
      const nextRound = 2;
      const nextPosition = Math.floor(matchup.position / 2);
      const slot = matchup.position % 2 === 0 ? "itemAId" : "itemBId";

      await prisma.bracketMatchup.updateMany({
        where: { bracketId, round: nextRound, position: nextPosition },
        data: { [slot]: matchup.winnerId },
      });
    }
  }
}
