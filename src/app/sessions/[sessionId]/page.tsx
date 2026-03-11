import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function VoteEntryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const requestUserId = auth?.userId ?? null;
  const vote = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      joinCode: true,
      status: true,
      creatorId: true,
      isPrivate: true,
      isModeratedHidden: true,
      space: {
        select: {
          visibility: true,
          members: requestUserId
            ? {
                where: { userId: requestUserId },
                select: { id: true },
                take: 1,
              }
            : false,
        },
      },
    },
  });

  if (!vote) notFound();
  const isOwner = !!requestUserId && vote.creatorId === requestUserId;
  const isParticipant = requestUserId
    ? (await prisma.participant.count({
        where: { sessionId, userId: requestUserId },
      })) > 0
    : false;
  if (vote.isModeratedHidden && !isOwner && !isParticipant) {
    notFound();
  }
  if (vote.space) {
    const isSpaceMember = Array.isArray(vote.space.members) && vote.space.members.length > 0;
    if (vote.space.visibility === "PRIVATE" && !isSpaceMember) notFound();
  } else if (vote.isPrivate && !isOwner && !isParticipant) {
    notFound();
  }

  if (vote.status !== "OPEN") {
    redirect(`/sessions/${sessionId}/results`);
  }

  if (isParticipant) {
    redirect(`/sessions/${sessionId}/vote`);
  }

  redirect(`/sessions/join?code=${encodeURIComponent(vote.joinCode)}`);
}
