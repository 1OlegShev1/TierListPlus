import { NextResponse } from "next/server";
import {
  badRequest,
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
import { addSessionItemSchema } from "@/lib/validators";

export const POST = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  const { session } = await requireSessionItemManager(request, sessionId, {
    includeTemplateId: true,
  });
  await requireOpenSession(sessionId);

  const data = await validateBody(request, addSessionItemSchema);
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

  const sessionItem = await prisma.$transaction(async (tx) => {
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
        label: restData.label,
        imageUrl: restData.imageUrl,
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
        label: restData.label,
        imageUrl: restData.imageUrl,
        ...sourceData,
        ...(hasSourceLink && sourceNote !== undefined ? { sourceNote } : {}),
        ...intervalData,
        sortOrder,
      },
    });
  });

  return NextResponse.json(sessionItem, { status: 201 });
});
