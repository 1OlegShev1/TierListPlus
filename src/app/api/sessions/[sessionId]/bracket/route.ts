import { NextResponse } from "next/server";
import { badRequest, bracketMatchupInclude, notFound, withHandler } from "@/lib/api-helpers";
import { generateBracket } from "@/lib/bracket-generator";
import { advanceWinnerToNextRound } from "@/lib/bracket-helpers";
import { prisma } from "@/lib/prisma";

export const GET = withHandler(async (_request, { params }) => {
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

  if (!bracket) notFound("No bracket found");

  return NextResponse.json(bracket);
});

export const POST = withHandler(async (_request, { params }) => {
  const { sessionId } = await params;

  // Check if bracket already exists
  const existing = await prisma.bracket.findFirst({ where: { sessionId } });
  if (existing) badRequest("Bracket already exists");

  const items = await prisma.sessionItem.findMany({
    where: { sessionId },
    orderBy: { sortOrder: "asc" },
  });

  if (items.length < 2) badRequest("Need at least 2 items for a bracket");

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
          winnerId:
            m.itemAId && !m.itemBId ? m.itemAId : !m.itemAId && m.itemBId ? m.itemBId : null,
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
  const byeMatchups = await prisma.bracketMatchup.findMany({
    where: { bracketId: bracket.id, round: 1 },
    orderBy: { position: "asc" },
  });

  for (const matchup of byeMatchups) {
    if (matchup.winnerId) {
      await advanceWinnerToNextRound(bracket.id, matchup.position, matchup.winnerId, 1, rounds);
    }
  }

  return NextResponse.json(bracket, { status: 201 });
});
