import { NextResponse } from "next/server";
import {
  requireOpenSession,
  requireSessionItemManager,
  validateBody,
  withHandler,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { addSessionItemSchema } from "@/lib/validators";

export const POST = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  const { session } = await requireSessionItemManager(request, sessionId, {
    includeTemplateId: true,
  });
  await requireOpenSession(sessionId);

  const data = await validateBody(request, addSessionItemSchema);

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
        label: data.label,
        imageUrl: data.imageUrl,
        sortOrder,
      },
    });

    return tx.sessionItem.create({
      data: {
        sessionId,
        templateItemId: templateItem.id,
        label: data.label,
        imageUrl: data.imageUrl,
        sortOrder,
      },
    });
  });

  return NextResponse.json(sessionItem, { status: 201 });
});
