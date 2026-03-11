import { NextResponse } from "next/server";
import { requireAdmin, withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

function getDateDaysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

export const GET = withHandler(async (request) => {
  await requireAdmin(request);

  const nowIso = new Date().toISOString();
  const last24hStart = getDateDaysAgo(1);
  const last7dStart = getDateDaysAgo(7);

  const [
    usersTotal,
    usersCreated24h,
    usersCreated7d,
    usersActive7d,
    publicTemplatesAvailableTotal,
    publicTemplatesModeratedTotal,
    publicTemplatesCreated7d,
    sessionsTotal,
    publicSessionsAvailableTotal,
    publicSessionsModeratedTotal,
    openSessionsTotal,
    sessionsCreated24h,
    sessionsCreated7d,
    participantsTotal,
    participantsJoined7d,
    participantsSubmitted7d,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: { createdAt: { gte: last24hStart } },
    }),
    prisma.user.count({
      where: { createdAt: { gte: last7dStart } },
    }),
    prisma.user.count({
      where: {
        devices: {
          some: {
            revokedAt: null,
            lastSeenAt: { gte: last7dStart },
          },
        },
      },
    }),
    prisma.template.count({
      where: {
        isPublic: true,
        isHidden: false,
        isModeratedHidden: false,
        spaceId: null,
      },
    }),
    prisma.template.count({
      where: {
        isPublic: true,
        isHidden: false,
        isModeratedHidden: true,
        spaceId: null,
      },
    }),
    prisma.template.count({
      where: {
        isPublic: true,
        isHidden: false,
        isModeratedHidden: false,
        spaceId: null,
        createdAt: { gte: last7dStart },
      },
    }),
    prisma.session.count(),
    prisma.session.count({
      where: {
        isPrivate: false,
        isModeratedHidden: false,
        spaceId: null,
      },
    }),
    prisma.session.count({
      where: {
        isPrivate: false,
        isModeratedHidden: true,
        spaceId: null,
      },
    }),
    prisma.session.count({
      where: { status: "OPEN" },
    }),
    prisma.session.count({
      where: { createdAt: { gte: last24hStart } },
    }),
    prisma.session.count({
      where: { createdAt: { gte: last7dStart } },
    }),
    prisma.participant.count(),
    prisma.participant.count({
      where: { createdAt: { gte: last7dStart } },
    }),
    prisma.participant.count({
      where: { submittedAt: { gte: last7dStart } },
    }),
  ]);

  return NextResponse.json({
    generatedAt: nowIso,
    windows: {
      last24hStart: last24hStart.toISOString(),
      last7dStart: last7dStart.toISOString(),
    },
    totals: {
      users: usersTotal,
      usersActive7d,
      publicTemplatesAvailable: publicTemplatesAvailableTotal,
      publicTemplatesModerated: publicTemplatesModeratedTotal,
      sessions: sessionsTotal,
      publicSessionsAvailable: publicSessionsAvailableTotal,
      publicSessionsModerated: publicSessionsModeratedTotal,
      openSessions: openSessionsTotal,
      participants: participantsTotal,
    },
    recent: {
      usersCreated24h,
      usersCreated7d,
      publicTemplatesCreated7d,
      sessionsCreated24h,
      sessionsCreated7d,
      participantsJoined7d,
      participantsSubmitted7d,
    },
  });
});
