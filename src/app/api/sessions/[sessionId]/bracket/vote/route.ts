import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bracketVoteSchema } from "@/lib/validators";
import { withHandler, validateBody, verifyParticipant, notFound, badRequest, requireOpenSession } from "@/lib/api-helpers";

export const POST = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  await requireOpenSession(sessionId);
  const data = await validateBody(request, bracketVoteSchema);

  const { matchupId, participantId, chosenItemId } = data;

  await verifyParticipant(participantId, sessionId);

  // Verify matchup exists and item is valid
  const matchup = await prisma.bracketMatchup.findUnique({
    where: { id: matchupId },
  });

  if (!matchup) notFound("Matchup not found");

  if (chosenItemId !== matchup.itemAId && chosenItemId !== matchup.itemBId) {
    badRequest("Chosen item is not in this matchup");
  }

  const vote = await prisma.bracketVote.upsert({
    where: {
      matchupId_participantId: { matchupId, participantId },
    },
    update: { chosenItemId },
    create: { matchupId, participantId, chosenItemId },
  });

  return NextResponse.json(vote);
});
