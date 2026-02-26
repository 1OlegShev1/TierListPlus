import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { submitVotesSchema } from "@/lib/validators";

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
  const body = await request.json();
  const parsed = submitVotesSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { participantId, votes } = parsed.data;

  // Verify participant belongs to this session
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, sessionId },
  });

  if (!participant) {
    return NextResponse.json(
      { error: "Participant not found in this session" },
      { status: 404 }
    );
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
      })
    )
  );

  return NextResponse.json(result);
}
