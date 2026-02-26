import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { joinSessionSchema } from "@/lib/validators";
import { validateBody, notFound, badRequest } from "@/lib/api-helpers";

export async function POST(request: Request) {
  const data = await validateBody(request, joinSessionSchema);
  if (data instanceof NextResponse) return data;

  const { joinCode, nickname } = data;

  const session = await prisma.session.findUnique({
    where: { joinCode: joinCode.toUpperCase() },
  });

  if (!session) return notFound("Session not found");

  if (session.status !== "OPEN") {
    return badRequest("Session is no longer accepting votes");
  }

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
}
