import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { badRequest, notFound, validateBody, withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { joinSessionSchema } from "@/lib/validators";

export const POST = withHandler(async (request) => {
  const data = await validateBody(request, joinSessionSchema);
  const { userId } = await requireRequestAuth(request);

  const { joinCode, nickname } = data;

  const session = await prisma.session.findUnique({
    where: { joinCode: joinCode.toUpperCase() },
    select: {
      id: true,
      status: true,
      isLocked: true,
      space: {
        select: {
          id: true,
          name: true,
          visibility: true,
          members: {
            where: { userId },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!session) notFound("Session not found");
  if (session.status !== "OPEN") badRequest("Session is no longer accepting votes");
  if (
    session.space?.visibility === "PRIVATE" &&
    (!Array.isArray(session.space.members) || session.space.members.length === 0)
  ) {
    return NextResponse.json(
      {
        error: "Only members of this private space can join this vote",
        code: "SPACE_MEMBERSHIP_REQUIRED",
        spaceId: session.space.id,
        spaceName: session.space.name,
        spaceVisibility: session.space.visibility,
      },
      { status: 403 },
    );
  }

  const existingForUser = await prisma.participant.findFirst({
    where: {
      sessionId: session.id,
      userId,
    },
    orderBy: { createdAt: "asc" },
  });

  if (existingForUser) {
    return NextResponse.json({
      sessionId: session.id,
      participantId: existingForUser.id,
      nickname: existingForUser.nickname,
    });
  }

  const existingByNickname = await prisma.participant.findUnique({
    where: {
      sessionId_nickname: { sessionId: session.id, nickname },
    },
  });
  if (existingByNickname?.userId && existingByNickname.userId !== userId) {
    badRequest("Nickname is already taken in this session");
  }
  if (session.isLocked && !existingByNickname) {
    badRequest("Session is locked. New participants cannot join.");
  }

  const participant = existingByNickname
    ? await prisma.participant.update({
        where: { id: existingByNickname.id },
        data: existingByNickname.userId ? {} : { userId },
      })
    : await (async () => {
        try {
          return await prisma.participant.create({
            data: {
              sessionId: session.id,
              nickname,
              userId,
            },
          });
        } catch (error) {
          const isDuplicateParticipantForUser =
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002" &&
            Array.isArray(error.meta?.target) &&
            (error.meta.target as string[]).includes("sessionId") &&
            (error.meta.target as string[]).includes("userId");

          if (!isDuplicateParticipantForUser) {
            throw error;
          }

          const concurrentParticipant = await prisma.participant.findFirst({
            where: {
              sessionId: session.id,
              userId,
            },
            orderBy: { createdAt: "asc" },
          });

          if (!concurrentParticipant) {
            throw error;
          }

          return concurrentParticipant;
        }
      })();

  return NextResponse.json({
    sessionId: session.id,
    participantId: participant.id,
    nickname: participant.nickname,
  });
});
