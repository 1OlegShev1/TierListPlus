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
import { resolveItemImageUrlForCreate } from "@/lib/item-image-storage";
import {
  normalizeItemLabel,
  normalizeItemSourceNote,
  resolveItemSourceForWrite,
  resolveSourceIntervalForWrite,
} from "@/lib/item-source";
import { prisma } from "@/lib/prisma";
import { tryDeleteManagedUploadIfUnreferenced } from "@/lib/upload-gc";
import { addTemplateItemSchema } from "@/lib/validators";

export const POST = withHandler(async (request, { params }) => {
  const { templateId } = await params;
  const data = await validateBody(request, addTemplateItemSchema);
  const auth = await getRequestAuth(request);
  const userId = auth?.userId ?? null;
  const isAdmin = auth?.role === "ADMIN";

  const template = await prisma.template.findUnique({
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
      isAdmin ||
      (!!userId && (template.space?.creatorId === userId || spaceMember?.role === "OWNER"));
    if (!canMutateSpaceResource(template.creatorId, userId, isSpaceOwner, isAdmin)) {
      forbidden("You are not allowed to edit this list");
    }
  } else if (!isAdmin) {
    requireOwner(template.creatorId, userId);
  }

  const {
    imageUrl: rawImageUrl,
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
  let imageUrl: string;
  try {
    imageUrl = await resolveItemImageUrlForCreate(rawImageUrl, sourceData.sourceUrl);
  } catch (error) {
    badRequest(error instanceof Error ? error.message : "Invalid image URL");
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
  const normalizedLabel = normalizeItemLabel(restData.label) || "New item";

  // Auto-set sort order atomically with create.
  const item = await (async () => {
    try {
      return await prisma.$transaction(async (tx) => {
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
            label: normalizedLabel,
            imageUrl,
            ...sourceData,
            ...(hasSourceLink && sourceNote !== undefined ? { sourceNote } : {}),
            ...intervalData,
            sortOrder,
            templateId,
          },
        });
      });
    } catch (error) {
      await tryDeleteManagedUploadIfUnreferenced(imageUrl, "template item create failure");
      throw error;
    }
  })();

  return NextResponse.json(item, { status: 201 });
});
