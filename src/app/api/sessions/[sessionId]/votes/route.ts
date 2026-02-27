import { NextResponse } from "next/server";
import {
  badRequest,
  requireOpenSession,
  validateBody,
  verifyParticipant,
  withHandler,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { submitVotesSchema } from "@/lib/validators";

export const GET = withHandler(async (_request, { params }) => {
  const { sessionId } = await params;
  const votes = await prisma.tierVote.findMany({
    where: { sessionItem: { sessionId } },
    include: {
      participant: { select: { id: true, nickname: true } },
      sessionItem: { select: { id: true, label: true, imageUrl: true } },
    },
  });

  return NextResponse.json(votes);
});

export const POST = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  await requireOpenSession(sessionId);
  const data = await validateBody(request, submitVotesSchema);

  const { participantId, votes } = data;

  await verifyParticipant(participantId, sessionId);
  const uniqueItemIds = [...new Set(votes.map((vote) => vote.sessionItemId))];
  const validItemCount = await prisma.sessionItem.count({
    where: { sessionId, id: { in: uniqueItemIds } },
  });
  if (validItemCount !== uniqueItemIds.length) {
    badRequest("One or more votes reference items outside this session");
  }

  // Upsert all votes in a transaction
  const result = await prisma.$transaction(
    votes.map((vote) =>
      prisma.tierVote.upsert({
        where: {
          participantId_sessionItemId: {
            participantId,
            sessionItemId: vote.sessionItemId,
          },
        },
        update: {
          tierKey: vote.tierKey,
          rankInTier: vote.rankInTier,
        },
        create: {
          participantId,
          sessionItemId: vote.sessionItemId,
          tierKey: vote.tierKey,
          rankInTier: vote.rankInTier,
        },
      }),
    ),
  );

  return NextResponse.json(result);
});
