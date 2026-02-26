import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeConsensus } from "@/lib/consensus";
import { notFound } from "@/lib/api-helpers";
import type { TierConfig } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!session) return notFound("Session not found");

  const votes = await prisma.tierVote.findMany({
    where: { sessionItem: { sessionId } },
    select: { sessionItemId: true, tierKey: true },
  });

  const tierConfig = session.tierConfig as unknown as TierConfig[];
  const consensus = computeConsensus(votes, tierConfig, session.items);

  return NextResponse.json(consensus);
}
