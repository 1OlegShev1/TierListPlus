import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { submitVotesSchema } from "@/lib/validators";
import { withHandler, validateBody, verifyParticipant, requireOpenSession } from "@/lib/api-helpers";

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
      })
    )
  );

  return NextResponse.json(result);
});
