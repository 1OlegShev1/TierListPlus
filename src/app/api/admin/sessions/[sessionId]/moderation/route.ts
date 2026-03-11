import { NextResponse } from "next/server";
import {
  badRequest,
  notFound,
  requireModerator,
  validateBody,
  withHandler,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { adminSessionModerationSchema } from "@/lib/validators";

export const PATCH = withHandler(async (request, { params }) => {
  const { sessionId } = await params;
  const { userId } = await requireModerator(request);
  const data = await validateBody(request, adminSessionModerationSchema);

  const existing = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      spaceId: true,
      isPrivate: true,
      isModeratedHidden: true,
    },
  });

  if (!existing) notFound("Session not found");
  if (existing.spaceId) {
    badRequest("Space sessions are not yet supported in admin moderation");
  }
  if (existing.isPrivate && !existing.isModeratedHidden) {
    badRequest("Only public sessions can be moderated");
  }

  const nextReason = data.hidden ? (data.reason?.trim() ?? null) : null;

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: {
      isModeratedHidden: data.hidden,
      moderatedByUserId: data.hidden ? userId : null,
      moderationReason: nextReason,
      moderatedAt: data.hidden ? new Date() : null,
    },
    select: {
      id: true,
      isPrivate: true,
      isModeratedHidden: true,
      moderationReason: true,
      moderatedAt: true,
      moderatedByUserId: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(updated);
});
