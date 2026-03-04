import {
  badRequest,
  notFound,
  requireOpenSession,
  requireSessionItemManager,
  validateBody,
  withHandler,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { tryDeleteManagedUploadIfUnreferenced } from "@/lib/upload-gc";
import { updateSessionItemSchema } from "@/lib/validators";

export const PATCH = withHandler(async (request, { params }) => {
  const { sessionId, itemId } = await params;
  await requireSessionItemManager(request, sessionId);
  await requireOpenSession(sessionId);

  const data = await validateBody(request, updateSessionItemSchema);
  if (Object.keys(data).length === 0) {
    badRequest("No item changes provided");
  }

  const sessionItem = await prisma.sessionItem.findFirst({
    where: { id: itemId, sessionId },
    select: {
      id: true,
      templateItemId: true,
    },
  });

  if (!sessionItem) notFound("Session item not found");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.templateItem.update({
      where: { id: sessionItem.templateItemId },
      data,
    });

    return tx.sessionItem.update({
      where: { id: sessionItem.id },
      data,
    });
  });

  return Response.json(updated);
});

export const DELETE = withHandler(async (request, { params }) => {
  const { sessionId, itemId } = await params;
  await requireSessionItemManager(request, sessionId);
  await requireOpenSession(sessionId);

  const sessionItem = await prisma.sessionItem.findFirst({
    where: { id: itemId, sessionId },
    select: {
      id: true,
      imageUrl: true,
      templateItemId: true,
      _count: {
        select: {
          tierVotes: true,
          bracketVotesAsItemA: true,
          bracketVotesAsItemB: true,
          bracketWins: true,
          bracketVoteChoices: true,
        },
      },
    },
  });

  if (!sessionItem) notFound("Session item not found");

  const hasReferences =
    sessionItem._count.tierVotes > 0 ||
    sessionItem._count.bracketVotesAsItemA > 0 ||
    sessionItem._count.bracketVotesAsItemB > 0 ||
    sessionItem._count.bracketWins > 0 ||
    sessionItem._count.bracketVoteChoices > 0;

  if (hasReferences) {
    badRequest("This item already has saved votes and cannot be removed");
  }

  await prisma.$transaction(async (tx) => {
    await tx.sessionItem.delete({ where: { id: sessionItem.id } });
    await tx.templateItem.delete({ where: { id: sessionItem.templateItemId } });
  });

  await tryDeleteManagedUploadIfUnreferenced(sessionItem.imageUrl, "session item delete");
  return new Response(null, { status: 204 });
});
