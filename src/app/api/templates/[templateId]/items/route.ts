import { NextResponse } from "next/server";
import {
  badRequest,
  canMutateSpaceResource,
  forbidden,
  notFound,
  requireOwner,
  validateBody,
  withHandler,
} from "@/lib/api-helpers";
import { getRequestAuth } from "@/lib/auth";
import {
  normalizeItemSourceNote,
  resolveItemSourceForWrite,
  resolveSourceIntervalForWrite,
} from "@/lib/item-source";
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
      const spaceMember = Array.isArray(template.space?.members)
        ? (template.space.members[0] ?? null)
        : null;
      const isSpaceOwner =
        !!userId && (template.space?.creatorId === userId || spaceMember?.role === "OWNER");
      if (!canMutateSpaceResource(template.creatorId, userId, isSpaceOwner)) {
        forbidden("You are not allowed to edit this list");
      }
    } else {
      requireOwner(template.creatorId, userId);
    }

    const {
      sourceUrl: rawSourceUrl,
      sourceNote: rawSourceNote,
      sourceStartSec: rawSourceStartSec,
      sourceEndSec: rawSourceEndSec,
      ...restData
    } = data;
    let sourceData: ReturnType<typeof resolveItemSourceForWrite>;
    try {
      sourceData = resolveItemSourceForWrite(rawSourceUrl);
    } catch (error) {
      badRequest(error instanceof Error ? error.message : "Invalid source URL");
    }
    const sourceNote = normalizeItemSourceNote(rawSourceNote);
    const hasSourceLink = typeof sourceData.sourceUrl === "string";
    let intervalData: ReturnType<typeof resolveSourceIntervalForWrite>;
    try {
      intervalData = resolveSourceIntervalForWrite(
        sourceData.sourceProvider ?? null,
        rawSourceStartSec,
        rawSourceEndSec,
      );
    } catch (error) {
      badRequest(error instanceof Error ? error.message : "Invalid source interval");
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
        ...restData,
        ...sourceData,
        ...(hasSourceLink && sourceNote !== undefined ? { sourceNote } : {}),
        ...intervalData,
        sortOrder,
        templateId,
      },
    });
  });

  return NextResponse.json(item, { status: 201 });
});
