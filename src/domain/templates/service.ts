import { canMutateResource, canReadTemplate } from "@/domain/policy/access";
import { forbidden, notFound } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getTemplateVisibilityWhere } from "@/lib/template-access";

const PREVIEW_ITEM_COUNT = 4;

export async function listPersonalTemplates(userId: string | null, previewLimit: number) {
  const templates = await prisma.template.findMany({
    where: getTemplateVisibilityWhere(userId),
    include: { _count: { select: { items: true } } },
    orderBy: { updatedAt: "desc" },
  });

  if (previewLimit < 1 || templates.length === 0) {
    return templates.map((template) => ({ ...template, items: [] }));
  }

  const previewTemplateIds = templates.slice(0, previewLimit).map((template) => template.id);
  const previewTemplates = await prisma.template.findMany({
    where: { id: { in: previewTemplateIds } },
    select: {
      id: true,
      items: {
        take: PREVIEW_ITEM_COUNT,
        orderBy: { sortOrder: "asc" },
        select: { id: true, imageUrl: true, label: true },
      },
    },
  });
  const previewsByTemplateId = new Map(
    previewTemplates.map((template) => [template.id, template.items] as const),
  );

  return templates.map((template) => ({
    ...template,
    items: previewsByTemplateId.get(template.id) ?? [],
  }));
}

export async function getTemplateForRead(templateId: string, requestUserId: string | null) {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
      },
      space: {
        select: {
          id: true,
          name: true,
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
    notFound("Template not found");
  }

  const memberRole = Array.isArray(template.space?.members)
    ? template.space.members[0]?.role
    : null;
  const isSpaceMember = memberRole != null;
  const isOwner = !!requestUserId && template.creatorId === requestUserId;
  const canRead = canReadTemplate({
    isHidden: template.isHidden,
    isModeratedHidden: template.isModeratedHidden,
    isSpaceScoped: !!template.spaceId,
    spaceVisibility: template.space?.visibility ?? null,
    isSpaceMember,
    isPublic: template.isPublic,
    isOwner,
  });
  if (!canRead) {
    notFound("Template not found");
  }

  return template;
}

export async function requireTemplateMutator(templateId: string, requestUserId: string | null) {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      creatorId: true,
      isHidden: true,
      spaceId: true,
      space: {
        select: {
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
    notFound("Template not found");
  }

  if (template.isHidden) {
    notFound("Template not found");
  }

  const spaceMember = Array.isArray(template.space?.members) ? template.space.members[0] : null;
  const isSpaceOwner =
    !!requestUserId &&
    !!template.space &&
    (template.space.creatorId === requestUserId || spaceMember?.role === "OWNER");

  const canMutate = canMutateResource({
    creatorId: template.creatorId,
    requestUserId,
    isSpaceOwner,
  });
  if (!canMutate) {
    forbidden("You are not allowed to modify this list");
  }

  return {
    id: template.id,
    creatorId: template.creatorId,
    spaceId: template.spaceId,
    isSpaceOwner,
  };
}

export async function duplicateTemplateForUser(templateId: string, requestUserId: string) {
  const source = await getTemplateForRead(templateId, requestUserId);

  const duplicated = await prisma.template.create({
    data: {
      name: `${source.name} (Copy)`,
      description: source.description,
      creatorId: requestUserId,
      isPublic: false,
      items: {
        create: source.items.map((item) => ({
          label: item.label,
          imageUrl: item.imageUrl,
          sourceUrl: item.sourceUrl,
          sourceProvider: item.sourceProvider,
          sourceNote: item.sourceNote,
          sourceStartSec: item.sourceStartSec,
          sourceEndSec: item.sourceEndSec,
          sortOrder: item.sortOrder,
        })),
      },
    },
  });

  return { id: duplicated.id };
}
