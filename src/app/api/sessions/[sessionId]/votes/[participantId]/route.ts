import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyParticipant } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string; participantId: string }> }
) {
  const { sessionId, participantId } = await params;

  const participant = await verifyParticipant(participantId, sessionId);
  if (participant instanceof NextResponse) return participant;

  const votes = await prisma.tierVote.findMany({
    where: { participantId },
    include: {
      sessionItem: { select: { id: true, label: true, imageUrl: true } },
    },
    orderBy: { rankInTier: "asc" },
  });

  return NextResponse.json({ participant, votes });
}
