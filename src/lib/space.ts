import type { SpaceRole, SpaceVisibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface SpaceAccess {
  id: string;
  name: string;
  visibility: SpaceVisibility;
  creatorId: string;
  isMember: boolean;
  isOwner: boolean;
  role: SpaceRole | null;
}

export function canReadSpace(visibility: SpaceVisibility, isMember: boolean) {
  return visibility === "OPEN" || isMember;
}

export async function getSpaceAccessForUser(
  spaceId: string,
  userId: string | null,
): Promise<SpaceAccess | null> {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: {
      id: true,
      name: true,
      visibility: true,
      creatorId: true,
      members: userId
        ? {
            where: { userId },
            select: { role: true },
            take: 1,
          }
        : false,
    },
  });
  if (!space) return null;

  const member = Array.isArray(space.members) && space.members.length > 0 ? space.members[0] : null;
  const role = member?.role ?? null;
  const isMember = !!member;
  const isOwner = (userId != null && space.creatorId === userId) || role === "OWNER";

  return {
    id: space.id,
    name: space.name,
    visibility: space.visibility,
    creatorId: space.creatorId,
    isMember,
    isOwner,
    role,
  };
}
