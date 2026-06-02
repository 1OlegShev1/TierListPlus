import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdmin, withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
// Max window fetched; the client slices this down to the selected range (7/30/90).
const SERIES_DAYS = 90;

function getDateDaysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Count rows per UTC day for a fixed table/column, from windowStart onward. */
async function dailyCounts(
  table: string,
  dateCol: string,
  windowStart: Date,
  extraWhere?: Prisma.Sql,
): Promise<Map<string, number>> {
  const col = Prisma.raw(`"${dateCol}"`);
  const rows = await prisma.$queryRaw<{ day: Date; count: number }[]>(Prisma.sql`
    SELECT date_trunc('day', ${col}) AS day, count(*)::int AS count
    FROM ${Prisma.raw(`"${table}"`)}
    WHERE ${col} >= ${windowStart}
    ${extraWhere ? Prisma.sql`AND ${extraWhere}` : Prisma.empty}
    GROUP BY 1
    ORDER BY 1
  `);
  return new Map(rows.map((r) => [dayKey(new Date(r.day)), r.count]));
}

/** Count rows strictly before windowStart — the cumulative baseline. */
async function baselineCount(
  table: string,
  dateCol: string,
  windowStart: Date,
  extraWhere?: Prisma.Sql,
): Promise<number> {
  const col = Prisma.raw(`"${dateCol}"`);
  const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
    SELECT count(*)::int AS count
    FROM ${Prisma.raw(`"${table}"`)}
    WHERE ${col} < ${windowStart}
    ${extraWhere ? Prisma.sql`AND ${extraWhere}` : Prisma.empty}
  `);
  return rows[0]?.count ?? 0;
}

/** Build aligned new/cumulative arrays for one metric across the day grid. */
function buildSeries(days: string[], counts: Map<string, number>, baseline: number) {
  const created: number[] = [];
  const cumulative: number[] = [];
  let running = baseline;
  for (const day of days) {
    const n = counts.get(day) ?? 0;
    created.push(n);
    running += n;
    cumulative.push(running);
  }
  return { created, cumulative };
}

export const GET = withHandler(async (request) => {
  await requireAdmin(request);

  const now = new Date();
  const nowIso = now.toISOString();
  const last24hStart = getDateDaysAgo(1);
  const last7dStart = getDateDaysAgo(7);

  // Day grid: SERIES_DAYS UTC midnights ending today (inclusive).
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const seriesStart = new Date(todayUtc.getTime() - (SERIES_DAYS - 1) * DAY_MS);
  const days = Array.from({ length: SERIES_DAYS }, (_, i) =>
    dayKey(new Date(seriesStart.getTime() + i * DAY_MS)),
  );

  const publicTemplateWhere = Prisma.sql`"isPublic" = true AND "isHidden" = false AND "isModeratedHidden" = false AND "spaceId" IS NULL`;
  const submittedWhere = Prisma.sql`"submittedAt" IS NOT NULL`;

  const [
    usersTotal,
    usersCreated24h,
    usersActive7d,
    moderatorsTotal,
    adminsTotal,
    publicTemplatesAvailableTotal,
    publicTemplatesModeratedTotal,
    templatesTotal,
    sessionsTotal,
    publicSessionsAvailableTotal,
    publicSessionsModeratedTotal,
    openSessionsTotal,
    closedSessionsTotal,
    archivedSessionsTotal,
    sessionsCreated24h,
    participantsTotal,
    participantsJoined24h,
    participantsSubmitted24h,
    spacesTotal,
    devicesActiveTotal,
    votesTotal,
    // time series sources
    usersDaily,
    usersBaseline,
    sessionsDaily,
    sessionsBaseline,
    publicTemplatesDaily,
    publicTemplatesBaseline,
    participantsDaily,
    participantsBaseline,
    submissionsDaily,
    submissionsBaseline,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: last24hStart } } }),
    prisma.user.count({
      where: { devices: { some: { revokedAt: null, lastSeenAt: { gte: last7dStart } } } },
    }),
    prisma.user.count({ where: { role: "MODERATOR" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.template.count({
      where: { isPublic: true, isHidden: false, isModeratedHidden: false, spaceId: null },
    }),
    prisma.template.count({
      where: { isPublic: true, isHidden: false, isModeratedHidden: true, spaceId: null },
    }),
    prisma.template.count(),
    prisma.session.count(),
    prisma.session.count({ where: { isPrivate: false, isModeratedHidden: false, spaceId: null } }),
    prisma.session.count({ where: { isPrivate: false, isModeratedHidden: true, spaceId: null } }),
    prisma.session.count({ where: { status: "OPEN" } }),
    prisma.session.count({ where: { status: "CLOSED" } }),
    prisma.session.count({ where: { status: "ARCHIVED" } }),
    prisma.session.count({ where: { createdAt: { gte: last24hStart } } }),
    prisma.participant.count(),
    prisma.participant.count({ where: { createdAt: { gte: last24hStart } } }),
    prisma.participant.count({ where: { submittedAt: { gte: last24hStart } } }),
    prisma.space.count(),
    prisma.device.count({ where: { revokedAt: null, lastSeenAt: { gte: last7dStart } } }),
    prisma.tierVote.count(),
    dailyCounts("User", "createdAt", seriesStart),
    baselineCount("User", "createdAt", seriesStart),
    dailyCounts("Session", "createdAt", seriesStart),
    baselineCount("Session", "createdAt", seriesStart),
    dailyCounts("Template", "createdAt", seriesStart, publicTemplateWhere),
    baselineCount("Template", "createdAt", seriesStart, publicTemplateWhere),
    dailyCounts("Participant", "createdAt", seriesStart),
    baselineCount("Participant", "createdAt", seriesStart),
    dailyCounts("Participant", "submittedAt", seriesStart, submittedWhere),
    baselineCount("Participant", "submittedAt", seriesStart, submittedWhere),
  ]);

  return NextResponse.json({
    generatedAt: nowIso,
    windows: {
      last24hStart: last24hStart.toISOString(),
      last7dStart: last7dStart.toISOString(),
      seriesStart: seriesStart.toISOString(),
      seriesDays: SERIES_DAYS,
    },
    totals: {
      users: usersTotal,
      usersActive7d,
      moderators: moderatorsTotal,
      admins: adminsTotal,
      publicTemplatesAvailable: publicTemplatesAvailableTotal,
      publicTemplatesModerated: publicTemplatesModeratedTotal,
      templates: templatesTotal,
      sessions: sessionsTotal,
      publicSessionsAvailable: publicSessionsAvailableTotal,
      publicSessionsModerated: publicSessionsModeratedTotal,
      openSessions: openSessionsTotal,
      closedSessions: closedSessionsTotal,
      archivedSessions: archivedSessionsTotal,
      participants: participantsTotal,
      spaces: spacesTotal,
      activeDevices7d: devicesActiveTotal,
      votes: votesTotal,
    },
    recent: {
      usersCreated24h,
      sessionsCreated24h,
      participantsJoined24h,
      participantsSubmitted24h,
    },
    series: {
      days,
      users: buildSeries(days, usersDaily, usersBaseline),
      sessions: buildSeries(days, sessionsDaily, sessionsBaseline),
      publicTemplates: buildSeries(days, publicTemplatesDaily, publicTemplatesBaseline),
      participants: buildSeries(days, participantsDaily, participantsBaseline),
      submissions: buildSeries(days, submissionsDaily, submissionsBaseline),
    },
  });
});
