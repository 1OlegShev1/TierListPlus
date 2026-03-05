import type { SpaceAccentColor } from "@prisma/client";
import { canReadSpace } from "@/domain/policy/access";
import { resolveSpaceAccessContext } from "@/domain/policy/resolvers";
import { badRequest, forbidden, notFound } from "@/lib/api-helpers";
import { generateSpaceInviteCode } from "@/lib/nanoid";
import { prisma } from "@/lib/prisma";
import { tryDeleteManagedUploadIfUnreferenced } from "@/lib/upload-gc";
import { extractManagedUploadFilename } from "@/lib/uploads";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVITE_RETRY_LIMIT = 10;

const SPACE_LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  logoUrl: true,
  accentColor: true,
  visibility: true,
  creatorId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { members: true, templates: true, sessions: true } },
} as const;

export async function listSpacesForUser(userId: string | null) {
  if (!userId) {
    const discoverOpenSpaces = await prisma.space.findMany({
      where: { visibility: "OPEN" },
      select: SPACE_LIST_SELECT,
      orderBy: { updatedAt: "desc" },
    });

    return {
      mySpaces: [],
      discoverOpenSpaces,
    };
  }

  const [mySpaces, discoverOpenSpaces] = await Promise.all([
    prisma.space.findMany({
      where: { members: { some: { userId } } },
      select: SPACE_LIST_SELECT,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.space.findMany({
      where: {
        visibility: "OPEN",
        NOT: { members: { some: { userId } } },
      },
      select: SPACE_LIST_SELECT,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return {
    mySpaces,
    discoverOpenSpaces,
  };
}

export async function createSpace(input: {
  ownerUserId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  accentColor?: SpaceAccentColor;
  visibility: "PRIVATE" | "OPEN";
}) {
  if (!input.name.trim()) {
    badRequest("Space name is required");
  }

  const description = input.description?.trim() ?? "";
  const logoUrl = input.logoUrl?.trim() || null;
  if (logoUrl && !extractManagedUploadFilename(logoUrl)) {
    badRequest("Invalid logo URL");
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.space.create({
      data: {
        name: input.name.trim(),
        description: description.length > 0 ? description : null,
        logoUrl,
        accentColor: input.accentColor ?? "SLATE",
        visibility: input.visibility,
        creatorId: input.ownerUserId,
      },
    });

    await tx.spaceMember.create({
      data: {
        spaceId: created.id,
        userId: input.ownerUserId,
        role: "OWNER",
      },
    });

    return created;
  });
}

export async function getSpaceDetails(spaceId: string, requestUserId: string | null) {
  const access = await resolveSpaceAccessContext(spaceId, requestUserId);
  if (!access) {
    notFound("Space not found");
  }

  if (!canReadSpace({ visibility: access.visibility, isMember: access.isMember })) {
    forbidden("This space is private");
  }

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
      createdAt: true,
      updatedAt: true,
      _count: { select: { members: true, templates: true, sessions: true } },
    },
  });

  if (!space) {
    notFound("Space not found");
  }

  return {
    ...space,
    currentUserId: requestUserId,
    isMember: access.isMember,
    isOwner: access.isOwner,
    role: access.memberRole,
  };
}

export async function updateSpace(
  spaceId: string,
  requestUserId: string | null,
  patch: {
    name?: string;
    description?: string | null;
    logoUrl?: string | null;
    accentColor?: SpaceAccentColor;
    visibility?: "PRIVATE" | "OPEN";
  },
) {
  const access = await resolveSpaceAccessContext(spaceId, requestUserId);
  if (!access) {
    notFound("Space not found");
  }
  if (!access.isOwner) {
    forbidden("Only the space owner can update this space");
  }
  const previousLogoUrl = access.logoUrl;
  if (
    patch.logoUrl !== undefined &&
    patch.logoUrl &&
    !extractManagedUploadFilename(patch.logoUrl)
  ) {
    badRequest("Invalid logo URL");
  }

  const updated = await prisma.space.update({
    where: { id: spaceId },
    data: {
      ...(patch.name != null ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined
        ? {
            description:
              patch.description == null
                ? null
                : patch.description.trim().length > 0
                  ? patch.description.trim()
                  : null,
          }
        : {}),
      ...(patch.logoUrl !== undefined ? { logoUrl: patch.logoUrl?.trim() || null } : {}),
      ...(patch.accentColor != null ? { accentColor: patch.accentColor } : {}),
      ...(patch.visibility != null ? { visibility: patch.visibility } : {}),
    },
  });

  if (patch.logoUrl !== undefined && previousLogoUrl && previousLogoUrl !== updated.logoUrl) {
    await tryDeleteManagedUploadIfUnreferenced(previousLogoUrl, "space logo update");
  }

  return updated;
}

export async function joinPrivateSpaceByInviteCode(userId: string, code: string) {
  const invite = await prisma.spaceInvite.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: {
      space: {
        select: {
          id: true,
          visibility: true,
        },
      },
    },
  });

  if (!invite || invite.revokedAt || invite.expiresAt <= new Date()) {
    notFound("Invite code is invalid or expired");
  }

  if (invite.space.visibility !== "PRIVATE") {
    badRequest("This invite code is not valid for a private space");
  }

  const existing = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: invite.spaceId, userId } },
  });

  if (existing) {
    return { spaceId: invite.spaceId, joined: false };
  }

  await prisma.spaceMember.create({
    data: {
      spaceId: invite.spaceId,
      userId,
      role: "MEMBER",
    },
  });

  return { spaceId: invite.spaceId, joined: true };
}

export async function listSpaceMembers(spaceId: string, requestUserId: string | null) {
  const access = await resolveSpaceAccessContext(spaceId, requestUserId);
  if (!access) {
    notFound("Space not found");
  }
  if (!access.isMember) {
    if (access.visibility === "PRIVATE") {
      forbidden("This space is private");
    }
    forbidden("You must join this space first");
  }

  const members = await prisma.spaceMember.findMany({
    where: { spaceId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      userId: true,
      role: true,
      createdAt: true,
    },
  });

  return { members };
}

export async function joinOpenSpace(spaceId: string, userId: string) {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: {
      id: true,
      visibility: true,
    },
  });

  if (!space) {
    notFound("Space not found");
  }

  if (space.visibility !== "OPEN") {
    forbidden("Only open spaces support one-click join");
  }

  const existing = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId, userId } },
  });

  if (existing) {
    return { joined: false };
  }

  await prisma.spaceMember.create({
    data: {
      spaceId,
      userId,
      role: "MEMBER",
    },
  });

  return { joined: true };
}

export async function leaveSpace(spaceId: string, userId: string) {
  const membership = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId, userId } },
    include: {
      space: {
        select: {
          creatorId: true,
        },
      },
    },
  });

  if (!membership) {
    notFound("Membership not found");
  }

  if (membership.role === "OWNER" || membership.space.creatorId === userId) {
    badRequest("Space owner cannot leave the space");
  }

  await prisma.spaceMember.delete({
    where: { id: membership.id },
  });
}

export async function removeSpaceMember(
  spaceId: string,
  actorUserId: string | null,
  targetUserId: string,
) {
  const access = await resolveSpaceAccessContext(spaceId, actorUserId);
  if (!access) {
    notFound("Space not found");
  }
  if (!access.isOwner) {
    forbidden("Only the space owner can remove members");
  }

  if (targetUserId === access.creatorId) {
    badRequest("Space owner cannot be removed");
  }

  const member = await prisma.spaceMember.findUnique({
    where: {
      spaceId_userId: { spaceId, userId: targetUserId },
    },
    select: { id: true },
  });

  if (!member) {
    notFound("Member not found");
  }

  await prisma.spaceMember.delete({ where: { id: member.id } });
}

export async function getPrivateSpaceInvite(spaceId: string, requestUserId: string | null) {
  const access = await resolveSpaceAccessContext(spaceId, requestUserId);
  if (!access) {
    notFound("Space not found");
  }
  if (!access.isOwner) {
    forbidden("Only the space owner can view space invites");
  }
  if (access.visibility !== "PRIVATE") {
    badRequest("Invite codes are only used for private spaces");
  }

  const activeInvite = await prisma.spaceInvite.findFirst({
    where: {
      spaceId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    invite: activeInvite
      ? {
          code: activeInvite.code,
          expiresAt: activeInvite.expiresAt,
          createdAt: activeInvite.createdAt,
        }
      : null,
  };
}

export async function rotatePrivateSpaceInvite(spaceId: string, requestUserId: string | null) {
  const access = await resolveSpaceAccessContext(spaceId, requestUserId);
  if (!access) {
    notFound("Space not found");
  }
  if (!access.isOwner || !requestUserId) {
    forbidden("Only the space owner can rotate space invites");
  }
  if (access.visibility !== "PRIVATE") {
    badRequest("Invite codes are only used for private spaces");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

  const invite = await prisma.$transaction(async (tx) => {
    await tx.spaceInvite.updateMany({
      where: {
        spaceId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    for (let attempt = 0; attempt < INVITE_RETRY_LIMIT; attempt++) {
      const code = generateSpaceInviteCode();
      const existing = await tx.spaceInvite.findUnique({ where: { code } });
      if (existing) continue;

      return tx.spaceInvite.create({
        data: {
          spaceId,
          code,
          expiresAt,
          createdByUserId: requestUserId,
        },
      });
    }

    throw new Error("Failed to generate unique invite code");
  });

  return {
    code: invite.code,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  };
}

export async function listSpaceTemplates(spaceId: string, requestUserId: string | null) {
  const access = await resolveSpaceAccessContext(spaceId, requestUserId);
  if (!access) {
    notFound("Space not found");
  }
  if (!canReadSpace({ visibility: access.visibility, isMember: access.isMember })) {
    forbidden("This space is private");
  }

  return prisma.template.findMany({
    where: {
      spaceId,
      isHidden: false,
    },
    include: {
      _count: { select: { items: true } },
      items: {
        take: 4,
        orderBy: { sortOrder: "asc" },
        select: { id: true, imageUrl: true, label: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getSpaceTemplate(
  spaceId: string,
  templateId: string,
  requestUserId: string | null,
) {
  const access = await resolveSpaceAccessContext(spaceId, requestUserId);
  if (!access) {
    notFound("Space not found");
  }
  if (!canReadSpace({ visibility: access.visibility, isMember: access.isMember })) {
    forbidden("This space is private");
  }

  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      spaceId,
      isHidden: false,
    },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!template) {
    notFound("Template not found");
  }

  return template;
}

export async function createSpaceTemplate(
  spaceId: string,
  requestUserId: string | null,
  payload: {
    name: string;
    description?: string;
  },
) {
  const access = await resolveSpaceAccessContext(spaceId, requestUserId);
  if (!access) {
    notFound("Space not found");
  }
  if (!access.isMember || !requestUserId) {
    forbidden("You must join this space first");
  }

  return prisma.template.create({
    data: {
      name: payload.name,
      description: payload.description,
      creatorId: requestUserId,
      isPublic: false,
      spaceId,
    },
  });
}
