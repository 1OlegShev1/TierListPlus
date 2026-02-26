import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { joinSessionSchema } from "@/lib/validators";
import { withHandler, validateBody, notFound, badRequest } from "@/lib/api-helpers";

export const POST = withHandler(async (request) => {
  const data = await validateBody(request, joinSessionSchema);

  const { joinCode, nickname } = data;

  const session = await prisma.session.findUnique({
    where: { joinCode: joinCode.toUpperCase() },
  });

  if (!session) notFound("Session not found");
  if (session.status !== "OPEN") badRequest("Session is no longer accepting votes");

  // Upsert participant (same nickname in same session returns existing)
  const participant = await prisma.participant.upsert({
    where: {
      sessionId_nickname: {
        sessionId: session.id,
        nickname,
      },
    },
    update: {},
    create: {
      sessionId: session.id,
      nickname,
    },
  });

  return NextResponse.json({
    sessionId: session.id,
    participantId: participant.id,
    nickname: participant.nickname,
  });
});
