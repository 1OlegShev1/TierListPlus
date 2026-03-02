import {
  badRequest,
  notFound,
  requireOpenSession,
  requireSessionOwner,
  withHandler,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { tryDeleteManagedUploadIfUnreferenced } from "@/lib/upload-gc";

export const DELETE = withHandler(async (request, { params }) => {
  const { sessionId, itemId } = await params;
  await requireSessionOwner(request, sessionId);
  await requireOpenSession(sessionId);

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { template: { select: { isHidden: true } } },
  });

  if (!session) notFound("Session not found");
  if (!session.template.isHidden) {
    badRequest("This session must be recreated before live item editing is available");
  }

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
