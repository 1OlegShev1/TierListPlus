import { NextResponse } from "next/server";
import {
  badRequest,
  notFound,
  requireOpenSession,
  requireSessionOwner,
  validateBody,
  withHandler,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { addSessionItemSchema } from "@/lib/validators";

export const POST = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  await requireSessionOwner(request, sessionId);
  await requireOpenSession(sessionId);

  const data = await validateBody(request, addSessionItemSchema);
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      templateId: true,
      template: { select: { isHidden: true } },
    },
  });

  if (!session) notFound("Session not found");
  if (!session.template.isHidden) {
    badRequest("This session must be recreated before live item editing is available");
  }

  const sessionItem = await prisma.$transaction(async (tx) => {
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
