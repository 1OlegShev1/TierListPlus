import { NextResponse } from "next/server";
import { notFound, requireSessionAccess, withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const POST = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  await requireSessionAccess(request, sessionId);
  const { userId: requestUserId } = await requireRequestAuth(request);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      name: true,
      creatorId: true,
      isPrivate: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          label: true,
          imageUrl: true,
          sortOrder: true,
        },
      },
      template: {
        select: {
          description: true,
          isHidden: true,
        },
      },
    },
  });

  if (!session) notFound("Session not found");

  const isOwner = session.creatorId === requestUserId;

  if (isOwner && session.template.isHidden) {
    const template = await prisma.template.create({
      data: {
        name: session.name,
        description: session.template.description,
        creatorId: requestUserId,
        isPublic: !session.isPrivate,
        items: {
          create: session.items.map((item, index) => ({
            label: item.label,
            imageUrl: item.imageUrl,
            sortOrder: item.sortOrder ?? index,
          })),
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ id: template.id, mode: "published" });
  }

  const template = await prisma.template.create({
    data: {
      name: isOwner ? session.name : `${session.name} (Copy)`,
      description: session.template.description,
      creatorId: requestUserId,
      isPublic: false,
      items: {
        create: session.items.map((item, index) => ({
          label: item.label,
          imageUrl: item.imageUrl,
          sortOrder: item.sortOrder ?? index,
        })),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: template.id, mode: "copied" });
});
