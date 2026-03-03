import { NextResponse } from "next/server";
import { withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const GET = withHandler(async (request) => {
  const { userId } = await requireRequestAuth(request);
  const previewItems = {
    take: 4,
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, imageUrl: true, label: true },
  };

  const myTemplates = await prisma.template.findMany({
    where: { creatorId: userId, isHidden: false },
    include: {
      _count: { select: { items: true } },
      items: previewItems,
    },
    orderBy: { createdAt: "desc" },
  });
  const myTemplateIds = myTemplates.map((template) => template.id);

  const [mySessions, participatedSessions, fromMyTemplates] = await Promise.all([
    prisma.session.findMany({
      where: { creatorId: userId },
      include: {
        template: { select: { name: true, isHidden: true } },
        items: previewItems,
        _count: { select: { participants: true, items: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.session.findMany({
      where: {
        participants: { some: { userId } },
        NOT: { creatorId: userId },
      },
      include: {
        template: { select: { name: true, isHidden: true } },
        items: previewItems,
        _count: { select: { participants: true, items: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    myTemplateIds.length === 0
      ? Promise.resolve([])
      : prisma.session.findMany({
          where: {
            sourceTemplateId: { in: myTemplateIds },
            creatorId: { not: userId },
            isPrivate: false,
          },
          include: {
            template: { select: { name: true, isHidden: true } },
            items: previewItems,
            _count: { select: { participants: true, items: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 4,
        }),
  ]);

  return NextResponse.json({ myTemplates, mySessions, participatedSessions, fromMyTemplates });
});
