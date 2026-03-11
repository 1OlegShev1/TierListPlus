import { NextResponse } from "next/server";
import { requireModerator, withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(searchParams: URLSearchParams) {
  const raw = searchParams.get("limit");
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

export const GET = withHandler(async (request) => {
  await requireModerator(request);

  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams);

  const [templates, sessions] = await Promise.all([
    prisma.template.findMany({
      where: {
        spaceId: null,
        isHidden: false,
        isPublic: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        creatorId: true,
        isPublic: true,
        isModeratedHidden: true,
        moderationReason: true,
        moderatedAt: true,
        moderatedByUserId: true,
        updatedAt: true,
        _count: { select: { items: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    prisma.session.findMany({
      where: {
        spaceId: null,
        isPrivate: false,
      },
      select: {
        id: true,
        name: true,
        joinCode: true,
        status: true,
        creatorId: true,
        isPrivate: true,
        isLocked: true,
        isModeratedHidden: true,
        moderationReason: true,
        moderatedAt: true,
        moderatedByUserId: true,
        updatedAt: true,
        template: { select: { name: true, isHidden: true } },
        _count: { select: { participants: true, items: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    templates,
    sessions,
  });
});
