import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { joinSessionSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = joinSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { joinCode, nickname } = parsed.data;

  const session = await prisma.session.findUnique({
    where: { joinCode: joinCode.toUpperCase() },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "OPEN") {
    return NextResponse.json(
      { error: "Session is no longer accepting votes" },
      { status: 400 }
    );
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
