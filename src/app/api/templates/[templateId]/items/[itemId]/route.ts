import type { Prisma } from "@prisma/client";
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
import { tryDeleteManagedUploadIfUnreferenced } from "@/lib/upload-gc";
import { updateTemplateItemSchema } from "@/lib/validators";

export const PATCH = withHandler(async (request, { params }) => {
  const { templateId, itemId } = await params;
  const auth = await getRequestAuth(request);
  const userId = auth?.userId ?? null;
  const isAdmin = auth?.role === "ADMIN";

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: {
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

  const existing = await prisma.templateItem.findFirst({
    where: { id: itemId, templateId },
    select: {
      id: true,
      imageUrl: true,
      sourceUrl: true,
      sourceProvider: true,
      sourceStartSec: true,
      sourceEndSec: true,
    },
  });
  if (!existing) notFound("Template item not found");

  const data = await validateBody(request, updateTemplateItemSchema);
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
  const sourceFieldsTouched = rawSourceUrl !== undefined || rawSourceNote !== undefined;
  const intervalFieldsTouched = rawSourceStartSec !== undefined || rawSourceEndSec !== undefined;
  const hasSourceLinkNow =
    sourceData.sourceUrl === undefined
      ? !!existing.sourceUrl
      : typeof sourceData.sourceUrl === "string";
  const nextSourceProviderWithPresence = hasSourceLinkNow
    ? (sourceData.sourceProvider ?? existing.sourceProvider ?? null)
    : null;
  if (sourceFieldsTouched || intervalFieldsTouched) {
    const validationStartSec =
      rawSourceStartSec !== undefined
        ? rawSourceStartSec
        : nextSourceProviderWithPresence === "YOUTUBE"
          ? existing.sourceStartSec
          : undefined;
    const validationEndSec =
      rawSourceEndSec !== undefined
        ? rawSourceEndSec
        : nextSourceProviderWithPresence === "YOUTUBE"
          ? existing.sourceEndSec
          : undefined;
    try {
      resolveSourceIntervalForWrite(
        nextSourceProviderWithPresence,
        validationStartSec,
        validationEndSec,
      );
    } catch (error) {
      badRequest(error instanceof Error ? error.message : "Invalid source interval");
    }
  }
  let intervalData: ReturnType<typeof resolveSourceIntervalForWrite>;
  try {
    intervalData = resolveSourceIntervalForWrite(
      nextSourceProviderWithPresence,
      rawSourceStartSec,
      rawSourceEndSec,
    );
  } catch (error) {
    badRequest(error instanceof Error ? error.message : "Invalid source interval");
  }
  const updateData: Prisma.TemplateItemUpdateInput = {
    ...restData,
    ...sourceData,
  };
  if (sourceFieldsTouched) {
    if (!hasSourceLinkNow) {
      updateData.sourceNote = null;
    } else if (sourceNote !== undefined) {
      updateData.sourceNote = sourceNote;
    }
    if (!hasSourceLinkNow || nextSourceProviderWithPresence !== "YOUTUBE") {
      updateData.sourceStartSec = null;
      updateData.sourceEndSec = null;
    }
  }
  if (intervalFieldsTouched) {
    if (nextSourceProviderWithPresence !== "YOUTUBE") {
      updateData.sourceStartSec = null;
      updateData.sourceEndSec = null;
    } else {
      if (intervalData.sourceStartSec !== undefined) {
        updateData.sourceStartSec = intervalData.sourceStartSec;
      }
      if (intervalData.sourceEndSec !== undefined) {
        updateData.sourceEndSec = intervalData.sourceEndSec;
      }
    }
  }

  if (Object.keys(updateData).length === 0) {
    badRequest("No item changes provided");
  }

  const item = await prisma.templateItem.update({
    where: { id: itemId, templateId },
    data: updateData,
  });

  if (data.imageUrl && data.imageUrl !== existing.imageUrl) {
    await tryDeleteManagedUploadIfUnreferenced(existing.imageUrl, "template item image update");
  }

  return NextResponse.json(item);
});

export const DELETE = withHandler(async (_request, { params }) => {
  const { templateId, itemId } = await params;
  const auth = await getRequestAuth(_request);
  const userId = auth?.userId ?? null;
  const isAdmin = auth?.role === "ADMIN";

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: {
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

  const existing = await prisma.templateItem.findFirst({
    where: { id: itemId, templateId },
    select: { id: true, imageUrl: true },
  });
  if (!existing) notFound("Template item not found");

  await prisma.templateItem.delete({ where: { id: itemId } });
  await tryDeleteManagedUploadIfUnreferenced(existing.imageUrl, "template item delete");
  return new Response(null, { status: 204 });
});
