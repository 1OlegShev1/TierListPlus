import { NextResponse } from "next/server";
import {
  badRequest,
  notFound,
  requireModerator,
  validateBody,
  withHandler,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { adminTemplateModerationSchema } from "@/lib/validators";

export const PATCH = withHandler(async (request, { params }) => {
  const { templateId } = await params;
  const { userId } = await requireModerator(request);
  const data = await validateBody(request, adminTemplateModerationSchema);

  const existing = await prisma.template.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      spaceId: true,
      isPublic: true,
      isHidden: true,
      isModeratedHidden: true,
    },
  });

  if (!existing) notFound("Template not found");
  if (existing.isHidden) notFound("Template not found");
  if (existing.spaceId) {
    badRequest("Space templates are not yet supported in admin moderation");
  }
  if (!existing.isPublic && !existing.isModeratedHidden) {
    badRequest("Only public templates can be moderated");
  }

  const nextReason = data.hidden ? (data.reason?.trim() ?? null) : null;

  const updated = await prisma.template.update({
    where: { id: templateId },
    data: {
      isModeratedHidden: data.hidden,
      moderatedByUserId: data.hidden ? userId : null,
      moderationReason: nextReason,
      moderatedAt: data.hidden ? new Date() : null,
    },
    select: {
      id: true,
      isPublic: true,
      isModeratedHidden: true,
      moderationReason: true,
      moderatedAt: true,
      moderatedByUserId: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(updated);
});
