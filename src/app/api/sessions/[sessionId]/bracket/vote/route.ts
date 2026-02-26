import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bracketVoteSchema } from "@/lib/validators";
import { validateBody, verifyParticipant, notFound, badRequest } from "@/lib/api-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const data = await validateBody(request, bracketVoteSchema);
  if (data instanceof NextResponse) return data;

  const { matchupId, participantId, chosenItemId } = data;

  // Verify participant belongs to this session
  const participant = await verifyParticipant(participantId, sessionId);
  if (participant instanceof NextResponse) return participant;

  // Verify matchup exists and item is valid
  const matchup = await prisma.bracketMatchup.findUnique({
    where: { id: matchupId },
  });

  if (!matchup) return notFound("Matchup not found");

  if (chosenItemId !== matchup.itemAId && chosenItemId !== matchup.itemBId) {
    return badRequest("Chosen item is not in this matchup");
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
