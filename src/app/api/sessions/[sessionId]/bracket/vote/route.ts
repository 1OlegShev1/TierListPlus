import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bracketVoteSchema } from "@/lib/validators";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await request.json();
  const parsed = bracketVoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { matchupId, participantId, chosenItemId } = parsed.data;

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

  // Verify matchup exists and item is valid
  const matchup = await prisma.bracketMatchup.findUnique({
    where: { id: matchupId },
  });

  if (!matchup) {
    return NextResponse.json({ error: "Matchup not found" }, { status: 404 });
  }

  if (chosenItemId !== matchup.itemAId && chosenItemId !== matchup.itemBId) {
    return NextResponse.json(
      { error: "Chosen item is not in this matchup" },
      { status: 400 }
    );
  }

  const vote = await prisma.bracketVote.upsert({
    where: {
      matchupId_participantId: { matchupId, participantId },
    },
    update: { chosenItemId },
    create: { matchupId, participantId, chosenItemId },
  });

  return NextResponse.json(vote);
}
