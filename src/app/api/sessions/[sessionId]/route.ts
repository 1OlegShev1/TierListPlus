import { NextResponse } from "next/server";
import {
  notFound,
  requireSessionAccess,
  requireSessionOwner,
  validateBody,
  withHandler,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { updateSessionSchema } from "@/lib/validators";

export const GET = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  await requireSessionAccess(request, sessionId);
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      template: { select: { name: true } },
      items: { orderBy: { sortOrder: "asc" } },
      participants: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { tierVotes: true } } },
      },
      _count: { select: { participants: true } },
    },
  });

  if (!session) notFound("Session not found");

  const participants = session.participants.map(({ _count, ...participant }) => ({
    ...participant,
    hasSubmitted: !!participant.submittedAt || _count.tierVotes > 0,
  }));

  return NextResponse.json({
    ...session,
    participants,
  });
});

export const PATCH = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  const data = await validateBody(request, updateSessionSchema);
  await requireSessionOwner(request, sessionId);

  const updateData: Record<string, unknown> = {};
  if (data.status) updateData.status = data.status;
  if (data.isPrivate !== undefined) updateData.isPrivate = data.isPrivate;
  if (data.isLocked !== undefined) updateData.isLocked = data.isLocked;
  if (data.tierConfig) updateData.tierConfig = JSON.parse(JSON.stringify(data.tierConfig));

  const session = await prisma.session.update({
    where: { id: sessionId },
    data: updateData,
  });

  return NextResponse.json(session);
});

export const DELETE = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  await requireSessionOwner(request, sessionId);

  await prisma.session.delete({ where: { id: sessionId } });
  return new Response(null, { status: 204 });
});
