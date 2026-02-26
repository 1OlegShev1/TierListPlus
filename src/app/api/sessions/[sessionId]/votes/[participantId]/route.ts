import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withHandler, verifyParticipant } from "@/lib/api-helpers";

export const GET = withHandler(async (_request, { params }) => {
  const { sessionId, participantId } = await params;

  const participant = await verifyParticipant(participantId, sessionId);

  const votes = await prisma.tierVote.findMany({
    where: { participantId },
    include: {
      sessionItem: { select: { id: true, label: true, imageUrl: true } },
    },
    orderBy: { rankInTier: "asc" },
  });

  return NextResponse.json({ participant, votes });
});
