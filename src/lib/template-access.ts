import type { Prisma } from "@prisma/client";

interface TemplateVisibility {
  creatorId: string | null;
  isPublic: boolean;
}

export function getTemplateVisibilityWhere(userId: string | null): Prisma.TemplateWhereInput {
  if (!userId) {
    return { isPublic: true };
  }

  return {
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
  return template.isPublic || isTemplateOwner(template, userId);
}
