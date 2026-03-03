import { NextResponse } from "next/server";
import { withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const HOME_SECTION_LIMIT = 4;

export const GET = withHandler(async (request) => {
  const { userId } = await requireRequestAuth(request);
  const previewItems = {
    take: HOME_SECTION_LIMIT,
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, imageUrl: true, label: true },
  };

  const [
    myTemplates,
    startedSessionCount,
    joinedSessionCount,
    mySessions,
    participatedSessions,
    fromMyTemplates,
  ] = await Promise.all([
    prisma.template.findMany({
      where: { creatorId: userId, isHidden: false },
      include: {
        _count: { select: { items: true } },
        items: previewItems,
      },
      orderBy: { createdAt: "desc" },
      take: HOME_SECTION_LIMIT,
    }),
    prisma.session.count({
      where: { creatorId: userId },
    }),
    prisma.session.count({
      where: {
        participants: { some: { userId } },
        NOT: { creatorId: userId },
      },
    }),
    prisma.session.findMany({
      where: {
        creatorId: userId,
        status: "OPEN",
      },
      include: {
        template: { select: { name: true, isHidden: true } },
        items: previewItems,
        _count: { select: { participants: true, items: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: HOME_SECTION_LIMIT,
    }),
    prisma.session.findMany({
      where: {
        status: "OPEN",
        participants: { some: { userId } },
        NOT: { creatorId: userId },
      },
      include: {
        template: { select: { name: true, isHidden: true } },
        items: previewItems,
        _count: { select: { participants: true, items: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: HOME_SECTION_LIMIT,
    }),
    prisma.session.findMany({
      where: {
        sourceTemplate: {
          creatorId: userId,
          isHidden: false,
        },
        creatorId: { not: userId },
        isPrivate: false,
      },
      include: {
        template: { select: { name: true, isHidden: true } },
        items: previewItems,
        _count: { select: { participants: true, items: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: HOME_SECTION_LIMIT,
    }),
  ]);
  const hasAnyActivity = startedSessionCount > 0 || joinedSessionCount > 0;

  return NextResponse.json({
    myTemplates,
    mySessions,
    participatedSessions,
    fromMyTemplates,
    hasAnyActivity,
  });
});
