import { NextResponse } from "next/server";
import { notFound, withHandler } from "@/lib/api-helpers";
import { computeConsensus } from "@/lib/consensus";
import { prisma } from "@/lib/prisma";
import { tierConfigSchema } from "@/lib/validators";

export const GET = withHandler(async (_request, { params }) => {
  const { sessionId } = await params;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!session) notFound("Session not found");

  const votes = await prisma.tierVote.findMany({
    where: { sessionItem: { sessionId } },
    select: { sessionItemId: true, tierKey: true },
  });

  const tierConfig = tierConfigSchema.parse(session.tierConfig);
  const consensus = computeConsensus(votes, tierConfig, session.items);

  return NextResponse.json(consensus);
});
