import { NextResponse } from "next/server";
import { verifyParticipant, withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const GET = withHandler(async (_request, { params }) => {
  const { sessionId, participantId } = await params;

  const participant = await verifyParticipant(participantId, sessionId);

  const votes = await prisma.tierVote.findMany({
    where: { participantId, sessionItem: { sessionId } },
    include: {
      sessionItem: { select: { id: true, label: true, imageUrl: true } },
    },
    orderBy: { rankInTier: "asc" },
  });

  return NextResponse.json({ participant, votes });
});
