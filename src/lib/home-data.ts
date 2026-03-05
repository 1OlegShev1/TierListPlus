import { prisma } from "@/lib/prisma";
import { buildSessionCardInclude, buildSessionPreviewItemsInclude } from "@/lib/session-query";

export const HOME_VOTE_SECTION_LIMIT = 4;
export const HOME_LIST_SECTION_LIMIT = 6;

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
  const previewItems = buildSessionPreviewItemsInclude(HOME_VOTE_SECTION_LIMIT);
  const sessionCardInclude = buildSessionCardInclude(HOME_VOTE_SECTION_LIMIT);

  const [
    myTemplates,
    startedSessionCount,
    joinedSessionCount,
    mySessions,
    participatedSessions,
    fromMyTemplates,
  ] = await Promise.all([
    prisma.template.findMany({
      where: { creatorId: userId, isHidden: false, spaceId: null },
      include: {
        _count: { select: { items: true } },
        items: previewItems,
      },
      orderBy: { createdAt: "desc" },
      take: HOME_LIST_SECTION_LIMIT,
    }),
    prisma.session.count({
      where: { creatorId: userId, spaceId: null },
    }),
    prisma.session.count({
      where: {
        spaceId: null,
        participants: { some: { userId } },
        NOT: { creatorId: userId },
      },
    }),
    prisma.session.findMany({
      where: {
        spaceId: null,
        creatorId: userId,
        status: "OPEN",
      },
      include: sessionCardInclude,
      orderBy: { updatedAt: "desc" },
      take: HOME_VOTE_SECTION_LIMIT,
    }),
    prisma.session.findMany({
      where: {
        spaceId: null,
        status: "OPEN",
        participants: { some: { userId } },
        NOT: { creatorId: userId },
      },
      include: sessionCardInclude,
      orderBy: { updatedAt: "desc" },
      take: HOME_VOTE_SECTION_LIMIT,
    }),
    prisma.session.findMany({
      where: {
        spaceId: null,
        status: "OPEN",
        sourceTemplate: {
          creatorId: userId,
          isHidden: false,
        },
        creatorId: { not: userId },
        isPrivate: false,
      },
      include: sessionCardInclude,
      orderBy: { updatedAt: "desc" },
      take: HOME_VOTE_SECTION_LIMIT,
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
