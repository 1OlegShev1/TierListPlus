import { NextResponse } from "next/server";
import { notFound, requireSessionAccess, verifyParticipant, withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const GET = withHandler(async (request, { params }) => {
  const { sessionId, participantId } = await params;
  await requireSessionAccess(request, sessionId);

  const participant = await verifyParticipant(participantId, sessionId);

  const votes = await prisma.tierVote.findMany({
    where: { participantId, sessionItem: { sessionId } },
    include: {
      sessionItem: { select: { id: true, label: true, imageUrl: true } },
    },
    orderBy: { rankInTier: "asc" },
  });

  if (votes.length === 0) {
    notFound("This participant has not submitted votes yet");
  }

  return NextResponse.json({ participant, votes });
});
