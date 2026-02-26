import { NextResponse } from "next/server";
import { notFound, validateBody, withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { updateSessionSchema } from "@/lib/validators";

export const GET = withHandler(async (_request, { params }) => {
  const { sessionId } = await params;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      template: { select: { name: true } },
      items: { orderBy: { sortOrder: "asc" } },
      participants: { orderBy: { createdAt: "asc" } },
      _count: { select: { participants: true } },
    },
  });

  if (!session) notFound("Session not found");

  return NextResponse.json(session);
});

export const PATCH = withHandler(async (request, { params }) => {
  const { sessionId } = await params;

  const existing = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!existing) notFound("Session not found");

  const data = await validateBody(request, updateSessionSchema);

  const updateData: Record<string, unknown> = {};
  if (data.status) updateData.status = data.status;
  if (data.tierConfig) updateData.tierConfig = JSON.parse(JSON.stringify(data.tierConfig));

  const session = await prisma.session.update({
    where: { id: sessionId },
    data: updateData,
  });

  return NextResponse.json(session);
});
