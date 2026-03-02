import type { Prisma } from "@prisma/client";

interface TemplateVisibility {
  creatorId: string | null;
  isPublic: boolean;
  isHidden?: boolean;
}

export function getTemplateVisibilityWhere(userId: string | null): Prisma.TemplateWhereInput {
  if (!userId) {
    return { isPublic: true, isHidden: false };
  }

  return {
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
  if (template.isHidden) return false;
  return template.isPublic || isTemplateOwner(template, userId);
}
