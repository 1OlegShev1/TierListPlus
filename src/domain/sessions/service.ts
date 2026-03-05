import { Prisma } from "@prisma/client";
import { canReadSpace } from "@/domain/policy/access";
import { resolveSpaceAccessContext } from "@/domain/policy/resolvers";
import { badRequest, forbidden, notFound } from "@/lib/api-helpers";
import { DEFAULT_TIER_CONFIG } from "@/lib/constants";
import { generateJoinCode } from "@/lib/nanoid";
import { prisma } from "@/lib/prisma";
import {
  SESSION_PARTICIPANT_COUNT_SELECT,
  SESSION_TEMPLATE_SELECT,
  SORT_ORDER_ASC,
} from "@/lib/session-query";
import { canAccessTemplate } from "@/lib/template-access";

const JOIN_CODE_RETRIES = 5;
const VALID_STATUSES = new Set(["OPEN", "CLOSED", "ARCHIVED"]);

export interface CreateSessionInput {
  creatorId: string;
  name: string;
  templateId?: string;
  tierConfig?: unknown;
  nickname?: string;
  isPrivate?: boolean;
  spaceId?: string | null;
}

export function assertValidSessionStatus(
  status: string | null,
): asserts status is "OPEN" | "CLOSED" | "ARCHIVED" | null {
  if (status == null) return;
  if (!VALID_STATUSES.has(status)) {
    badRequest("Invalid status filter. Must be OPEN, CLOSED, or ARCHIVED");
  }
}

export async function listPersonalSessions(
  userId: string | null,
  status: "OPEN" | "CLOSED" | "ARCHIVED" | null,
) {
  return prisma.session.findMany({
    where: userId
      ? {
          spaceId: null,
          ...(status ? { status } : {}),
          OR: [{ creatorId: userId }, { participants: { some: { userId } } }, { isPrivate: false }],
        }
      : {
          spaceId: null,
          ...(status ? { status } : {}),
          isPrivate: false,
        },
    include: {
      template: { select: SESSION_TEMPLATE_SELECT },
      _count: { select: SESSION_PARTICIPANT_COUNT_SELECT },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listSpaceSessions(
  spaceId: string,
  requestUserId: string | null,
  status: "OPEN" | "CLOSED" | "ARCHIVED" | null,
) {
  const access = await resolveSpaceAccessContext(spaceId, requestUserId);
  if (!access) {
    notFound("Space not found");
  }
  if (!canReadSpace({ visibility: access.visibility, isMember: access.isMember })) {
    forbidden("This space is private");
  }

  return prisma.session.findMany({
    where: {
      spaceId,
      ...(status ? { status } : {}),
    },
    include: {
      template: { select: SESSION_TEMPLATE_SELECT },
      _count: { select: SESSION_PARTICIPANT_COUNT_SELECT },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSession(input: CreateSessionInput) {
  const { creatorId, templateId, name, tierConfig, nickname, isPrivate, spaceId = null } = input;

  let sourceTemplate: {
    id: string;
    name: string;
    description: string | null;
    creatorId: string | null;
    isPublic: boolean;
    isHidden: boolean;
    spaceId: string | null;
    items: {
      id: string;
      label: string;
      imageUrl: string;
      sortOrder: number;
    }[];
  } | null = null;

  if (templateId) {
    sourceTemplate = await prisma.template.findUnique({
      where: { id: templateId },
      include: { items: { orderBy: SORT_ORDER_ASC } },
    });

    if (!sourceTemplate) {
      notFound("Template not found");
    }

    if (spaceId) {
      const isSpaceTemplate = sourceTemplate.spaceId === spaceId && !sourceTemplate.isHidden;
      const isAccessibleGlobalTemplate =
        sourceTemplate.spaceId == null && canAccessTemplate(sourceTemplate, creatorId);
      if (!isSpaceTemplate && !isAccessibleGlobalTemplate) {
        notFound("Template not found");
      }
    } else if (!canAccessTemplate(sourceTemplate, creatorId)) {
      notFound("Template not found");
    }
  }

  const workingTemplate = await prisma.template.create({
    data: {
      name: sourceTemplate?.name ?? name,
      description: sourceTemplate?.description ?? null,
      creatorId,
      isPublic: false,
      isHidden: true,
      ...(spaceId ? { spaceId } : {}),
      ...(sourceTemplate
        ? {
            items: {
              create: sourceTemplate.items.map((item) => ({
                label: item.label,
                imageUrl: item.imageUrl,
                sortOrder: item.sortOrder,
              })),
            },
          }
        : {}),
    },
    include: {
      items: { orderBy: SORT_ORDER_ASC },
    },
  });

  const session = await (async () => {
    for (let attempt = 0; attempt < JOIN_CODE_RETRIES; attempt++) {
      try {
        return await prisma.session.create({
          data: {
            name,
            templateId: workingTemplate.id,
            sourceTemplateId: sourceTemplate?.id ?? null,
            joinCode: generateJoinCode(),
            creatorId,
            tierConfig: JSON.parse(JSON.stringify(tierConfig ?? DEFAULT_TIER_CONFIG)),
            isPrivate: spaceId ? true : (isPrivate ?? true),
            ...(spaceId ? { spaceId } : {}),
            items: {
              create: workingTemplate.items.map((item) => ({
                templateItemId: item.id,
                label: item.label,
                imageUrl: item.imageUrl,
                sortOrder: item.sortOrder,
              })),
            },
          },
          include: {
            items: true,
            _count: { select: { participants: true } },
          },
        });
      } catch (err) {
        const isCodeCollision =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002" &&
          Array.isArray(err.meta?.target) &&
          (err.meta.target as string[]).includes("joinCode");
        if (!isCodeCollision || attempt === JOIN_CODE_RETRIES - 1) throw err;
      }
    }

    throw new Error("Failed to generate unique join code");
  })();

  let participantId: string | null = null;
  let participantNickname: string | null = null;

  if (nickname) {
    const participant = await prisma.participant.create({
      data: { sessionId: session.id, nickname, userId: creatorId },
    });
    participantId = participant.id;
    participantNickname = participant.nickname;
  }

  return { ...session, participantId, participantNickname };
}
