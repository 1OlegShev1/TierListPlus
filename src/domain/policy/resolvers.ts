import type { SpaceAccentColor, SpaceRole, SpaceVisibility, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface SpaceAccessContext {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  accentColor: SpaceAccentColor;
  visibility: SpaceVisibility;
  creatorId: string;
  memberRole: SpaceRole | null;
  isMember: boolean;
  isOwner: boolean;
  isAdmin: boolean;
}

export interface SessionAccessContext {
  id: string;
  creatorId: string | null;
  isPrivate: boolean;
  isModeratedHidden: boolean;
  spaceId: string | null;
  spaceVisibility: SpaceVisibility | null;
  spaceCreatorId: string | null;
  memberRole: SpaceRole | null;
  isSpaceMember: boolean;
  isSpaceOwner: boolean;
  isOwner: boolean;
  isParticipant: boolean;
  isAdmin: boolean;
}

export interface TemplateAccessContext {
  id: string;
  creatorId: string | null;
  isPublic: boolean;
  isHidden: boolean;
  isModeratedHidden: boolean;
  spaceId: string | null;
  spaceVisibility: SpaceVisibility | null;
  spaceCreatorId: string | null;
  memberRole: SpaceRole | null;
  isSpaceMember: boolean;
  isSpaceOwner: boolean;
  isOwner: boolean;
  isAdmin: boolean;
}

async function resolveRequestRole(
  requestUserId: string | null,
  requestRole?: UserRole | null,
): Promise<UserRole | null> {
  if (!requestUserId) return null;
  if (requestRole) return requestRole;

  const user = await prisma.user.findUnique({
    where: { id: requestUserId },
    select: { role: true },
  });

  return user?.role ?? null;
}

export async function resolveSpaceAccessContext(
  spaceId: string,
  requestUserId: string | null,
  requestRole?: UserRole | null,
) {
  const resolvedRole = await resolveRequestRole(requestUserId, requestRole);
  const isAdmin = resolvedRole === "ADMIN";

  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: {
      id: true,
      name: true,
      description: true,
      logoUrl: true,
      accentColor: true,
      visibility: true,
      creatorId: true,
      members: requestUserId
        ? {
            where: { userId: requestUserId },
            select: { role: true },
            take: 1,
          }
        : false,
    },
  });

  if (!space) {
    return null;
  }

  const memberRole = Array.isArray(space.members) ? (space.members[0]?.role ?? null) : null;
  const isMember = isAdmin || memberRole != null;
  const isOwner =
    isAdmin || (!!requestUserId && space.creatorId === requestUserId) || memberRole === "OWNER";

  return {
    id: space.id,
    name: space.name,
    description: space.description,
    logoUrl: space.logoUrl,
    accentColor: space.accentColor,
    visibility: space.visibility,
    creatorId: space.creatorId,
    memberRole,
    isMember,
    isOwner,
    isAdmin,
  } satisfies SpaceAccessContext;
}

export async function resolveSessionAccessContext(
  sessionId: string,
  requestUserId: string | null,
  requestRole?: UserRole | null,
) {
  const resolvedRole = await resolveRequestRole(requestUserId, requestRole);
  const isAdmin = resolvedRole === "ADMIN";

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      creatorId: true,
      isPrivate: true,
      isModeratedHidden: true,
      spaceId: true,
      participants: requestUserId
        ? {
            where: { userId: requestUserId },
            select: { id: true },
            take: 1,
          }
        : false,
      space: {
        select: {
          visibility: true,
          creatorId: true,
          members: requestUserId
            ? {
                where: { userId: requestUserId },
                select: { role: true },
                take: 1,
              }
            : false,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  const memberRole = Array.isArray(session.space?.members)
    ? (session.space.members[0]?.role ?? null)
    : null;
  const isSpaceMember = isAdmin || memberRole != null;
  const isSpaceOwner =
    isAdmin ||
    (!!requestUserId && session.space?.creatorId === requestUserId) ||
    memberRole === "OWNER";
  const isOwner = isAdmin || (!!requestUserId && session.creatorId === requestUserId);
  const isParticipant =
    isAdmin ||
    (!!requestUserId && Array.isArray(session.participants) && session.participants.length > 0);

  return {
    id: session.id,
    creatorId: session.creatorId,
    isPrivate: session.isPrivate,
    isModeratedHidden: session.isModeratedHidden,
    spaceId: session.spaceId,
    spaceVisibility: session.space?.visibility ?? null,
    spaceCreatorId: session.space?.creatorId ?? null,
    memberRole,
    isSpaceMember,
    isSpaceOwner,
    isOwner,
    isParticipant,
    isAdmin,
  } satisfies SessionAccessContext;
}

export async function resolveTemplateAccessContext(
  templateId: string,
  requestUserId: string | null,
  requestRole?: UserRole | null,
) {
  const resolvedRole = await resolveRequestRole(requestUserId, requestRole);
  const isAdmin = resolvedRole === "ADMIN";

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      creatorId: true,
      isPublic: true,
      isHidden: true,
      isModeratedHidden: true,
      spaceId: true,
      space: {
        select: {
          visibility: true,
          creatorId: true,
          members: requestUserId
            ? {
                where: { userId: requestUserId },
                select: { role: true },
                take: 1,
              }
            : false,
        },
      },
    },
  });

  if (!template) {
    return null;
  }

  const memberRole = Array.isArray(template.space?.members)
    ? (template.space.members[0]?.role ?? null)
    : null;
  const isSpaceMember = isAdmin || memberRole != null;
  const isSpaceOwner =
    isAdmin ||
    (!!requestUserId && template.space?.creatorId === requestUserId) ||
    memberRole === "OWNER";
  const isOwner = isAdmin || (!!requestUserId && template.creatorId === requestUserId);

  return {
    id: template.id,
    creatorId: template.creatorId,
    isPublic: template.isPublic,
    isHidden: template.isHidden,
    isModeratedHidden: template.isModeratedHidden,
    spaceId: template.spaceId,
    spaceVisibility: template.space?.visibility ?? null,
    spaceCreatorId: template.space?.creatorId ?? null,
    memberRole,
    isSpaceMember,
    isSpaceOwner,
    isOwner,
    isAdmin,
  } satisfies TemplateAccessContext;
}
