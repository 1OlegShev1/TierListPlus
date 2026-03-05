import type { SpaceAccentColor, SpaceRole, SpaceVisibility } from "@prisma/client";
import { canReadSpace as canReadSpacePolicy } from "@/domain/policy/access";
import { resolveSpaceAccessContext } from "@/domain/policy/resolvers";

export interface SpaceAccess {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  accentColor: SpaceAccentColor;
  visibility: SpaceVisibility;
  creatorId: string;
  isMember: boolean;
  isOwner: boolean;
  role: SpaceRole | null;
}

export function canReadSpace(visibility: SpaceVisibility, isMember: boolean) {
  return canReadSpacePolicy({ visibility, isMember });
}

export async function getSpaceAccessForUser(
  spaceId: string,
  userId: string | null,
): Promise<SpaceAccess | null> {
  const access = await resolveSpaceAccessContext(spaceId, userId);
  if (!access) return null;

  return {
    id: access.id,
    name: access.name,
    description: access.description,
    logoUrl: access.logoUrl,
    accentColor: access.accentColor,
    visibility: access.visibility,
    creatorId: access.creatorId,
    isMember: access.isMember,
    isOwner: access.isOwner,
    role: access.memberRole,
  };
}
