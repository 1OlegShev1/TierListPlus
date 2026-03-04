import { prisma } from "@/lib/prisma";

export const HOME_SECTION_LIMIT = 4;

export interface HomeListSummary {
  id: string;
  name: string;
  createdAt: string;
  items: { id: string; imageUrl: string; label: string }[];
  _count: { items: number };
}

export interface HomeVoteSummary {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  isPrivate: boolean;
  isLocked: boolean;
  template: { name: string; isHidden: boolean };
  items: { id: string; imageUrl: string; label: string }[];
  _count: { participants: number; items: number };
}

export interface HomeData {
  myTemplates: HomeListSummary[];
  mySessions: HomeVoteSummary[];
  participatedSessions: HomeVoteSummary[];
  fromMyTemplates: HomeVoteSummary[];
  hasAnyActivity: boolean;
}

export async function loadHomeData(userId: string): Promise<HomeData> {
  const previewItems = {
    take: HOME_SECTION_LIMIT,
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, imageUrl: true, label: true },
  };

  const [
    myTemplates,
    startedSessionCount,
    joinedSessionCount,
    mySessions,
    participatedSessions,
    fromMyTemplates,
  ] = await Promise.all([
    prisma.template.findMany({
      where: { creatorId: userId, isHidden: false },
      include: {
        _count: { select: { items: true } },
        items: previewItems,
      },
      orderBy: { createdAt: "desc" },
      take: HOME_SECTION_LIMIT,
    }),
    prisma.session.count({
      where: { creatorId: userId },
    }),
    prisma.session.count({
      where: {
        participants: { some: { userId } },
        NOT: { creatorId: userId },
      },
    }),
    prisma.session.findMany({
      where: {
        creatorId: userId,
        status: "OPEN",
      },
      include: {
        template: { select: { name: true, isHidden: true } },
        items: previewItems,
        _count: { select: { participants: true, items: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: HOME_SECTION_LIMIT,
    }),
    prisma.session.findMany({
      where: {
        status: "OPEN",
        participants: { some: { userId } },
        NOT: { creatorId: userId },
      },
      include: {
        template: { select: { name: true, isHidden: true } },
        items: previewItems,
        _count: { select: { participants: true, items: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: HOME_SECTION_LIMIT,
    }),
    prisma.session.findMany({
      where: {
        status: "OPEN",
        sourceTemplate: {
          creatorId: userId,
          isHidden: false,
        },
        creatorId: { not: userId },
        isPrivate: false,
      },
      include: {
        template: { select: { name: true, isHidden: true } },
        items: previewItems,
        _count: { select: { participants: true, items: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: HOME_SECTION_LIMIT,
    }),
  ]);

  return {
    myTemplates: myTemplates.map((template) => ({
      ...template,
      createdAt: template.createdAt.toISOString(),
    })),
    mySessions: mySessions.map((session) => ({
      ...session,
      updatedAt: session.updatedAt.toISOString(),
    })),
    participatedSessions: participatedSessions.map((session) => ({
      ...session,
      updatedAt: session.updatedAt.toISOString(),
    })),
    fromMyTemplates: fromMyTemplates.map((session) => ({
      ...session,
      updatedAt: session.updatedAt.toISOString(),
    })),
    hasAnyActivity: startedSessionCount > 0 || joinedSessionCount > 0,
  };
}
