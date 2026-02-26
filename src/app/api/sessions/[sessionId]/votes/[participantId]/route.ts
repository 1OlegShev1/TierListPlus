import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string; participantId: string }> }
) {
  const { sessionId, participantId } = await params;

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, sessionId },
  });

  if (!participant) {
    return NextResponse.json(
      { error: "Participant not found" },
      { status: 404 }
    );
  }

  const votes = await prisma.tierVote.findMany({
    where: { participantId },
    include: {
      sessionItem: { select: { id: true, label: true, imageUrl: true } },
    },
    orderBy: { rankInTier: "asc" },
  });

  return NextResponse.json({ participant, votes });
}
