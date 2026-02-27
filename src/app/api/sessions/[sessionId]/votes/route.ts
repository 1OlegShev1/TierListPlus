import { NextResponse } from "next/server";
import {
  badRequest,
  requireOpenSession,
  requireParticipantOwner,
  requireSessionAccess,
  validateBody,
  withHandler,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { submitVotesSchema, tierConfigSchema } from "@/lib/validators";

export const GET = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  await requireSessionAccess(request, sessionId);
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
  await requireSessionAccess(request, sessionId);
  await requireOpenSession(sessionId);
  const data = await validateBody(request, submitVotesSchema);

  const { participantId, votes } = data;

  if (votes.length === 0) {
    badRequest("At least one vote is required");
  }

  await requireParticipantOwner(request, participantId, sessionId);
  const uniqueItemIds = [...new Set(votes.map((vote) => vote.sessionItemId))];
  if (uniqueItemIds.length !== votes.length) {
    badRequest("Duplicate votes for the same item are not allowed");
  }

  const sessionItemCount = await prisma.sessionItem.count({ where: { sessionId } });
  if (uniqueItemIds.length !== sessionItemCount) {
    badRequest("All session items must be ranked before submitting");
  }

  const validItemCount = await prisma.sessionItem.count({
    where: { sessionId, id: { in: uniqueItemIds } },
  });
  if (validItemCount !== uniqueItemIds.length) {
    badRequest("One or more votes reference items outside this session");
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { tierConfig: true },
  });
  if (!session) {
    badRequest("Session not found");
  }
  const tierConfig = tierConfigSchema.parse(session.tierConfig);
  const allowedTierKeys = new Set(tierConfig.map((t) => t.key));
  for (const vote of votes) {
    if (!allowedTierKeys.has(vote.tierKey)) {
      badRequest(`Invalid tier key: ${vote.tierKey}`);
    }
  }

  // Rewrite participant votes atomically in one transaction.
  const result = await prisma.$transaction(async (tx) => {
    await tx.tierVote.deleteMany({ where: { participantId } });
    const created = await tx.tierVote.createMany({
      data: votes.map((vote) => ({
        participantId,
        sessionItemId: vote.sessionItemId,
        tierKey: vote.tierKey,
        rankInTier: vote.rankInTier,
      })),
    });
    await tx.participant.update({
      where: { id: participantId },
      data: { submittedAt: new Date() },
    });

    return { createdCount: created.count };
  });

  return NextResponse.json(result);
});
