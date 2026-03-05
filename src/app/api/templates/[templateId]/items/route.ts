import { NextResponse } from "next/server";
import {
  canMutateSpaceResource,
  forbidden,
  notFound,
  requireOwner,
  validateBody,
  withHandler,
} from "@/lib/api-helpers";
import { getRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addTemplateItemSchema } from "@/lib/validators";

export const POST = withHandler(async (request, { params }) => {
  const { templateId } = await params;
  const data = await validateBody(request, addTemplateItemSchema);
  const auth = await getRequestAuth(request);
  const userId = auth?.userId ?? null;

  // Verify template exists and auto-set sortOrder atomically
  const item = await prisma.$transaction(async (tx) => {
    const template = await tx.template.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        creatorId: true,
        spaceId: true,
        space: {
          select: {
            creatorId: true,
            members: userId
              ? {
                  where: { userId },
                  select: { role: true },
                  take: 1,
                }
              : false,
          },
        },
      },
    });
    if (!template) notFound("Template not found");
    if (template.spaceId) {
      const spaceMember = template.space?.members[0] ?? null;
      const isSpaceOwner =
        !!userId && (template.space?.creatorId === userId || spaceMember?.role === "OWNER");
      if (!canMutateSpaceResource(template.creatorId, userId, isSpaceOwner)) {
        forbidden("You are not allowed to edit this list");
      }
    } else {
      requireOwner(template.creatorId, userId);
    }

    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const lastItem = await tx.templateItem.findFirst({
        where: { templateId },
        orderBy: { sortOrder: "desc" },
      });
      sortOrder = (lastItem?.sortOrder ?? -1) + 1;
    }

    return tx.templateItem.create({
      data: {
        ...data,
        sortOrder,
        templateId,
      },
    });
  });

  return NextResponse.json(item, { status: 201 });
});
