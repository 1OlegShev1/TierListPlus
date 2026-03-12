import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  badRequest,
  forbidden,
  notFound,
  requireSessionAccess,
  validateBody,
  withHandler,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { updateSessionParticipantSchema } from "@/lib/validators";

export const PATCH = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  const data = await validateBody(request, updateSessionParticipantSchema);
  const { requestUserId } = await requireSessionAccess(request, sessionId);

  if (!requestUserId) {
    forbidden("Sign in to update your nickname");
  }

  const participant = await prisma.participant.findFirst({
    where: { sessionId, userId: requestUserId },
    select: { id: true, nickname: true },
    orderBy: { createdAt: "asc" },
  });
  if (!participant) {
    badRequest("Join this vote before updating your nickname");
  }

  const nextNickname = data.nickname.trim();
  if (nextNickname === participant.nickname) {
    return NextResponse.json({
      participantId: participant.id,
      nickname: participant.nickname,
    });
  }

  const existingByNickname = await prisma.participant.findUnique({
    where: {
      sessionId_nickname: { sessionId, nickname: nextNickname },
    },
    select: { id: true },
  });
  if (existingByNickname && existingByNickname.id !== participant.id) {
    badRequest("Nickname is already taken in this session");
  }

  const updated = await (async () => {
    try {
      return await prisma.participant.update({
        where: { id: participant.id },
        data: { nickname: nextNickname },
        select: { id: true, nickname: true },
      });
    } catch (error) {
      const isDuplicateNickname =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        Array.isArray(error.meta?.target) &&
        (error.meta.target as string[]).includes("sessionId") &&
        (error.meta.target as string[]).includes("nickname");

      if (isDuplicateNickname) {
        badRequest("Nickname is already taken in this session");
      }
      throw error;
    }
  })();

  try {
    await prisma.user.updateMany({
      where: { id: requestUserId },
      data: { nickname: updated.nickname },
    });
  } catch {
    // Suggestion persistence is best-effort only.
  }

  return NextResponse.json({
    participantId: updated.id,
    nickname: updated.nickname,
  });
});

export const DELETE = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  const { requestUserId, isOwner } = await requireSessionAccess(request, sessionId);

  if (!requestUserId) {
    forbidden("Sign in to leave this vote");
  }
  if (isOwner) {
    forbidden("Vote owners cannot leave this vote");
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { status: true },
  });
  if (!session) {
    notFound("Session not found");
  }
  if (session.status !== "OPEN") {
    badRequest("This vote is closed. Leaving is only available while voting is open.");
  }

  const deleted = await prisma.participant.deleteMany({
    where: { sessionId, userId: requestUserId },
  });
  if (deleted.count === 0) {
    badRequest("Join this vote before leaving");
  }

  return new Response(null, { status: 204 });
});
