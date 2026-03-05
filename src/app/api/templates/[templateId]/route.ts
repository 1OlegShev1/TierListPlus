import { NextResponse } from "next/server";
import { getTemplateForRead } from "@/domain/templates/service";
import {
  badRequest,
  canMutateSpaceResource,
  forbidden,
  notFound,
  requireOwner,
  validateBody,
  withHandler,
} from "@/lib/api-helpers";
import { getRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tryDeleteManagedUploadIfUnreferenced } from "@/lib/upload-gc";
import { updateTemplateSchema } from "@/lib/validators";

export const GET = withHandler(async (request, { params }) => {
  const { templateId } = await params;
  const auth = await getRequestAuth(request);
  const userId = auth?.userId ?? null;
  const template = await getTemplateForRead(templateId, userId);
  return NextResponse.json(template);
});

export const PATCH = withHandler(async (request, { params }) => {
  const { templateId } = await params;
  const auth = await getRequestAuth(request);
  const userId = auth?.userId ?? null;

  const existing = await prisma.template.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      creatorId: true,
      isHidden: true,
      spaceId: true,
      space: {
        select: {
          creatorId: true,
          members: userId
            ? {
                where: { userId },
                select: { role: true },
                take: 1,
              }
            : false,
        },
      },
    },
  });
  if (!existing) notFound("Template not found");
  if (existing.isHidden) notFound("Template not found");
  if (existing.spaceId) {
    const spaceMember = existing.space?.members[0] ?? null;
    const isSpaceOwner =
      !!userId && (existing.space?.creatorId === userId || spaceMember?.role === "OWNER");
    if (!canMutateSpaceResource(existing.creatorId, userId, isSpaceOwner)) {
      forbidden("You are not allowed to edit this list");
    }
  } else {
    requireOwner(existing.creatorId, userId);
  }

  const data = await validateBody(request, updateTemplateSchema);

  const template = await prisma.template.update({
    where: { id: templateId },
    data,
  });

  return NextResponse.json(template);
});

export const DELETE = withHandler(async (request, { params }) => {
  const { templateId } = await params;
  const auth = await getRequestAuth(request);
  const userId = auth?.userId ?? null;

  const existing = await prisma.template.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      creatorId: true,
      isHidden: true,
      spaceId: true,
      items: { select: { imageUrl: true } },
      _count: { select: { sessions: true } },
      space: {
        select: {
          creatorId: true,
          members: userId
            ? {
                where: { userId },
                select: { role: true },
                take: 1,
              }
            : false,
        },
      },
    },
  });
  if (!existing) notFound("Template not found");
  if (existing.isHidden) notFound("Template not found");
  if (existing.spaceId) {
    const spaceMember = existing.space?.members[0] ?? null;
    const isSpaceOwner =
      !!userId && (existing.space?.creatorId === userId || spaceMember?.role === "OWNER");
    if (!canMutateSpaceResource(existing.creatorId, userId, isSpaceOwner)) {
      forbidden("You are not allowed to delete this list");
    }
  } else {
    requireOwner(existing.creatorId, userId);
  }

  if (existing._count.sessions > 0) {
    badRequest(
      `Cannot delete: ${existing._count.sessions} session(s) use this template. Delete those sessions first.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.session.updateMany({
      where: { sourceTemplateId: templateId },
      data: { sourceTemplateId: null },
    });
    await tx.template.delete({ where: { id: templateId } });
  });
  const imageUrls = new Set(existing.items.map((item) => item.imageUrl));
  await Promise.all(
    [...imageUrls].map((imageUrl) =>
      tryDeleteManagedUploadIfUnreferenced(imageUrl, "template delete"),
    ),
  );
  return new Response(null, { status: 204 });
});
