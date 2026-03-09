import { NextResponse } from "next/server";
import {
  badRequest,
  requireOpenSession,
  requireSessionItemManager,
  validateBody,
  withHandler,
} from "@/lib/api-helpers";
import { resolveItemImageUrlForCreate } from "@/lib/item-image-storage";
import {
  normalizeItemLabel,
  normalizeItemSourceNote,
  resolveItemSourceForWrite,
  resolveSourceIntervalForWrite,
} from "@/lib/item-source";
import { prisma } from "@/lib/prisma";
import { tryDeleteManagedUploadIfUnreferenced } from "@/lib/upload-gc";
import { addSessionItemSchema } from "@/lib/validators";

export const POST = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  const { session } = await requireSessionItemManager(request, sessionId, {
    includeTemplateId: true,
  });
  await requireOpenSession(sessionId);

  const data = await validateBody(request, addSessionItemSchema);
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

  const sessionItem = await (async () => {
    try {
      return await prisma.$transaction(async (tx) => {
        // Serialize sort-order allocation per session across all clients/tabs.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('session_items'), hashtext(${sessionId}))`;

        const lastItem = await tx.sessionItem.findFirst({
          where: { sessionId },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });
        const sortOrder = data.sortOrder ?? (lastItem?.sortOrder ?? -1) + 1;

        const templateItem = await tx.templateItem.create({
          data: {
            templateId: session.templateId,
            label: normalizedLabel,
            imageUrl,
            ...sourceData,
            ...(hasSourceLink && sourceNote !== undefined ? { sourceNote } : {}),
            ...intervalData,
            sortOrder,
          },
        });

        return tx.sessionItem.create({
          data: {
            sessionId,
            templateItemId: templateItem.id,
            label: normalizedLabel,
            imageUrl,
            ...sourceData,
            ...(hasSourceLink && sourceNote !== undefined ? { sourceNote } : {}),
            ...intervalData,
            sortOrder,
          },
        });
      });
    } catch (error) {
      await tryDeleteManagedUploadIfUnreferenced(imageUrl, "session item create failure");
      throw error;
    }
  })();

  return NextResponse.json(sessionItem, { status: 201 });
});
