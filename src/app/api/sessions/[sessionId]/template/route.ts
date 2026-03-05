import { NextResponse } from "next/server";
import {
  canMutateSpaceResource,
  notFound,
  requireSessionAccess,
  withHandler,
} from "@/lib/api-helpers";
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
      spaceId: true,
      space: {
        select: {
          creatorId: true,
          members: {
            where: { userId: requestUserId },
            select: { role: true },
            take: 1,
          },
        },
      },
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
  const spaceMember = session.space?.members[0] ?? null;
  const isSpaceOwner =
    session.space != null &&
    (session.space.creatorId === requestUserId || spaceMember?.role === "OWNER");
  const canPublishSessionTemplate = canMutateSpaceResource(
    session.creatorId,
    requestUserId,
    isSpaceOwner,
  );

  if (canPublishSessionTemplate && session.template.isHidden) {
    const template = await prisma.template.create({
      data: {
        name: session.name,
        description: session.template.description,
        creatorId: requestUserId,
        isPublic: session.spaceId ? false : !session.isPrivate,
        spaceId: session.spaceId,
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
