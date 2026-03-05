import type { Prisma } from "@prisma/client";

interface TemplateVisibility {
  creatorId: string | null;
  isPublic: boolean;
  isHidden?: boolean;
  spaceId?: string | null;
}

export function getTemplateVisibilityWhere(
  userId: string | null,
  options?: { includeSpace?: boolean },
): Prisma.TemplateWhereInput {
  const baseWhere: Prisma.TemplateWhereInput = options?.includeSpace ? {} : { spaceId: null };

  if (!userId) {
    return { ...baseWhere, isPublic: true, isHidden: false };
  }

  return {
    ...baseWhere,
    isHidden: false,
    OR: [{ isPublic: true }, { creatorId: userId }],
  };
}

export function isTemplateOwner(
  template: Pick<TemplateVisibility, "creatorId">,
  userId: string | null,
) {
  return !!userId && !!template.creatorId && template.creatorId === userId;
}

export function canAccessTemplate(template: TemplateVisibility, userId: string | null) {
  if (template.spaceId) return false;
  if (template.isHidden) return false;
  return template.isPublic || isTemplateOwner(template, userId);
}
