import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { submitVotesSchema } from "@/lib/validators";
import { validateBody, verifyParticipant } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const votes = await prisma.tierVote.findMany({
    where: { sessionItem: { sessionId } },
    include: {
      participant: { select: { id: true, nickname: true } },
      sessionItem: { select: { id: true, label: true, imageUrl: true } },
    },
  });

  return NextResponse.json(votes);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const data = await validateBody(request, submitVotesSchema);
  if (data instanceof NextResponse) return data;

  const { participantId, votes } = data;

  // Verify participant belongs to this session
  const participant = await verifyParticipant(participantId, sessionId);
  if (participant instanceof NextResponse) return participant;

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
}
