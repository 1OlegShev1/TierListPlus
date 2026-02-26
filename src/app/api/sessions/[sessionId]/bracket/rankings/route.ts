import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withHandler, notFound } from "@/lib/api-helpers";
import { mitBacktrackRanking } from "@/lib/bracket-ranking";
import type { TierConfig } from "@/types";

/**
 * Returns bracket results mapped to tier placements using
 * the MIT Backtracking ranking algorithm.
 *
 * Response: { seededTiers: Record<tierKey, sessionItemId[]> }
 */
export const GET = withHandler(async (_request, { params }) => {
  const { sessionId } = await params;

  const [bracket, session] = await Promise.all([
    prisma.bracket.findFirst({
      where: { sessionId },
      include: {
        matchups: {
          orderBy: [{ round: "asc" }, { position: "asc" }],
        },
      },
    }),
    prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        tierConfig: true,
        items: { select: { id: true }, orderBy: { sortOrder: "asc" } },
      },
    }),
  ]);

  if (!bracket || !session) notFound("Bracket or session not found");

  const tierConfig = session.tierConfig as unknown as TierConfig[];
  const allItemIds = session.items.map((i) => i.id);
  const totalRounds = bracket.rounds;

  const ranked = mitBacktrackRanking(bracket.matchups, totalRounds, allItemIds);

  // Distribute into tiers evenly
  const sortedTiers = [...tierConfig].sort((a, b) => a.sortOrder - b.sortOrder);
  const tierCount = sortedTiers.length;
  const itemCount = ranked.length;
  const baseSize = Math.floor(itemCount / tierCount);
  const remainder = itemCount % tierCount;

  const seededTiers: Record<string, string[]> = {};
  let cursor = 0;

  for (let i = 0; i < tierCount; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    seededTiers[sortedTiers[i].key] = ranked.slice(cursor, cursor + size);
    cursor += size;
  }

  return NextResponse.json({ seededTiers });
});
