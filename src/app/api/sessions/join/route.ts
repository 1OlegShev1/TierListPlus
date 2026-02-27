import { NextResponse } from "next/server";
import { badRequest, getUserId, notFound, validateBody, withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { joinSessionSchema } from "@/lib/validators";

export const POST = withHandler(async (request) => {
  const data = await validateBody(request, joinSessionSchema);
  const userId = getUserId(request);
  if (!userId) badRequest("User identity required to join session");

  const { joinCode, nickname } = data;

  const session = await prisma.session.findUnique({
    where: { joinCode: joinCode.toUpperCase() },
  });

  if (!session) notFound("Session not found");
  if (session.status !== "OPEN") badRequest("Session is no longer accepting votes");

  // Existing nickname is only reusable by the same user/device.
  const existing = await prisma.participant.findUnique({
    where: {
      sessionId_nickname: { sessionId: session.id, nickname },
    },
  });
  if (existing?.userId && existing.userId !== userId) {
    badRequest("Nickname is already taken in this session");
  }
  if (session.isLocked && !existing) {
    badRequest("Session is locked. New participants cannot join.");
  }

  const participant = existing
    ? await prisma.participant.update({
        where: { id: existing.id },
        data: existing.userId ? {} : { userId },
      })
    : await prisma.participant.create({
        data: {
          sessionId: session.id,
          nickname,
          userId,
        },
      });

  return NextResponse.json({
    sessionId: session.id,
    participantId: participant.id,
    nickname: participant.nickname,
    bracketEnabled: session.bracketEnabled,
  });
});
