import { NextResponse } from "next/server";
import { requireUserId, withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const GET = withHandler(async (request) => {
  const userId = requireUserId(request);

  const [myTemplates, mySessions, participatedSessions] = await Promise.all([
    prisma.template.findMany({
      where: { creatorId: userId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.session.findMany({
      where: { creatorId: userId },
      include: {
        template: { select: { name: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.session.findMany({
      where: {
        participants: { some: { userId } },
        NOT: { creatorId: userId },
      },
      include: {
        template: { select: { name: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ myTemplates, mySessions, participatedSessions });
});
