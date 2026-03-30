import type { Prisma } from "@prisma/client";
import {
  badRequest,
  notFound,
  requireOpenSession,
  requireSessionItemManager,
  validateBody,
  withHandler,
} from "@/lib/api-helpers";
import {
  normalizeItemSourceNote,
  resolveItemSourceForWrite,
  resolveSourceIntervalForWrite,
} from "@/lib/item-source";
import { prisma } from "@/lib/prisma";
import { tryDeleteManagedUploadIfUnreferenced } from "@/lib/upload-gc";
import { updateSessionItemSchema } from "@/lib/validators";

export const PATCH = withHandler(async (request, { params }) => {
  const { sessionId, itemId } = await params;
  await requireSessionItemManager(request, sessionId);
  await requireOpenSession(sessionId);

  const data = await validateBody(request, updateSessionItemSchema);
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
  const sessionItem = await prisma.sessionItem.findFirst({
    where: { id: itemId, sessionId },
    select: {
      id: true,
      imageUrl: true,
      templateItemId: true,
      sourceUrl: true,
      sourceProvider: true,
      sourceStartSec: true,
      sourceEndSec: true,
    },
  });

  if (!sessionItem) notFound("Session item not found");

  const sourceNote = normalizeItemSourceNote(rawSourceNote);
  const sourceFieldsTouched = rawSourceUrl !== undefined || rawSourceNote !== undefined;
  const intervalFieldsTouched = rawSourceStartSec !== undefined || rawSourceEndSec !== undefined;
  const hasSourceLinkNow =
    sourceData.sourceUrl === undefined
      ? !!sessionItem.sourceUrl
      : typeof sourceData.sourceUrl === "string";
  const nextSourceProviderWithPresence = hasSourceLinkNow
    ? (sourceData.sourceProvider ?? sessionItem.sourceProvider ?? null)
    : null;
  if (sourceFieldsTouched || intervalFieldsTouched) {
    const validationStartSec =
      rawSourceStartSec !== undefined
        ? rawSourceStartSec
        : nextSourceProviderWithPresence === "YOUTUBE"
          ? sessionItem.sourceStartSec
          : undefined;
    const validationEndSec =
      rawSourceEndSec !== undefined
        ? rawSourceEndSec
        : nextSourceProviderWithPresence === "YOUTUBE"
          ? sessionItem.sourceEndSec
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
  const updateData: Prisma.SessionItemUpdateInput = {
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

  const updated = await prisma.$transaction(async (tx) => {
    await tx.templateItem.update({
      where: { id: sessionItem.templateItemId },
      data: updateData,
    });

    return tx.sessionItem.update({
      where: { id: sessionItem.id },
      data: updateData,
    });
  });

  if (data.imageUrl && data.imageUrl !== sessionItem.imageUrl) {
    await tryDeleteManagedUploadIfUnreferenced(sessionItem.imageUrl, "session item image update");
  }

  return Response.json(updated);
});

export const DELETE = withHandler(async (request, { params }) => {
  const { sessionId, itemId } = await params;
  await requireSessionItemManager(request, sessionId);
  await requireOpenSession(sessionId);

  const sessionItem = await prisma.sessionItem.findFirst({
    where: { id: itemId, sessionId },
    select: {
      id: true,
      imageUrl: true,
      templateItemId: true,
      _count: {
        select: {
          tierVotes: true,
        },
      },
    },
  });

  if (!sessionItem) notFound("Session item not found");

  const hasReferences = sessionItem._count.tierVotes > 0;

  if (hasReferences) {
    badRequest("This item already has saved rankings and cannot be removed");
  }

  await prisma.$transaction(async (tx) => {
    await tx.sessionItem.delete({ where: { id: sessionItem.id } });
    await tx.templateItem.delete({ where: { id: sessionItem.templateItemId } });
  });

  await tryDeleteManagedUploadIfUnreferenced(sessionItem.imageUrl, "session item delete");
  return new Response(null, { status: 204 });
});
