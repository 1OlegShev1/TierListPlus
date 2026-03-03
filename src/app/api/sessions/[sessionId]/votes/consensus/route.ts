import { NextResponse } from "next/server";
import { notFound, requireSessionAccess, withHandler } from "@/lib/api-helpers";
import { computeConsensus } from "@/lib/consensus";
import { prisma } from "@/lib/prisma";
import { tierConfigSchema } from "@/lib/validators";

export const GET = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  await requireSessionAccess(request, sessionId);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!session) notFound("Session not found");

  const votes = await prisma.tierVote.findMany({
    where: { sessionItem: { sessionId } },
    select: {
      participantId: true,
      participant: { select: { nickname: true } },
      sessionItemId: true,
      tierKey: true,
      rankInTier: true,
    },
  });

  const tierConfig = tierConfigSchema.parse(session.tierConfig);
  const consensus = computeConsensus(
    votes.map((vote) => ({
      participantId: vote.participantId,
      participantNickname: vote.participant.nickname,
      sessionItemId: vote.sessionItemId,
      tierKey: vote.tierKey,
      rankInTier: vote.rankInTier,
    })),
    tierConfig,
    session.items,
  );

  return NextResponse.json(consensus);
});
