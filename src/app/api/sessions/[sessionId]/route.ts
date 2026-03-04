import { NextResponse } from "next/server";
import {
  canManageSessionItems,
  notFound,
  requireSessionAccess,
  requireSessionOwner,
  validateBody,
  withHandler,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { tryDeleteManagedUploadIfUnreferenced } from "@/lib/upload-gc";
import { updateSessionSchema } from "@/lib/validators";

export const GET = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  const { requestUserId } = await requireSessionAccess(request, sessionId);
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      template: { select: { name: true, isHidden: true } },
      items: { orderBy: { sortOrder: "asc" } },
      participants: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { tierVotes: true } } },
      },
      _count: { select: { participants: true } },
    },
  });

  if (!session) notFound("Session not found");

  const currentParticipant = requestUserId
    ? (session.participants.find((participant) => participant.userId === requestUserId) ?? null)
    : null;
  const totalItemCount = session.items.length;
  const participants = session.participants.map(({ _count, ...participant }) => ({
    ...participant,
    hasSubmitted: _count.tierVotes > 0,
    hasSavedVotes: _count.tierVotes > 0,
    rankedItemCount: _count.tierVotes,
    totalItemCount,
    missingItemCount: Math.max(0, totalItemCount - _count.tierVotes),
    isComplete: totalItemCount > 0 && _count.tierVotes >= totalItemCount,
  }));

  return NextResponse.json({
    ...session,
    canManageItems: canManageSessionItems(
      session.template.isHidden,
      session.creatorId,
      requestUserId,
    ),
    participants,
    templateIsHidden: session.template.isHidden,
    currentParticipantId: currentParticipant?.id ?? null,
    currentParticipantNickname: currentParticipant?.nickname ?? null,
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

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      items: { select: { imageUrl: true } },
      template: {
        select: {
          id: true,
          isHidden: true,
          items: { select: { imageUrl: true } },
          _count: { select: { sessions: true } },
        },
      },
    },
  });
  if (!session) notFound("Session not found");

  await prisma.session.delete({ where: { id: sessionId } });

  const shouldDeleteWorkingTemplate =
    session.template.isHidden && session.template._count.sessions <= 1;

  if (shouldDeleteWorkingTemplate) {
    await prisma.template.delete({ where: { id: session.template.id } });
  }

  const imageUrls = new Set(
    shouldDeleteWorkingTemplate
      ? [...session.items, ...session.template.items].map((item) => item.imageUrl)
      : session.items.map((item) => item.imageUrl),
  );
  await Promise.all(
    [...imageUrls].map((imageUrl) =>
      tryDeleteManagedUploadIfUnreferenced(
        imageUrl,
        shouldDeleteWorkingTemplate ? "session + working template delete" : "session delete",
      ),
    ),
  );
  return new Response(null, { status: 204 });
});
