import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/user-session";

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;
  const requestUserId = token ? verifyUserSessionToken(token) : null;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      joinCode: true,
      status: true,
      creatorId: true,
      isPrivate: true,
    },
  });

  if (!session) notFound();
  const isOwner = !!requestUserId && session.creatorId === requestUserId;
  const isParticipant = requestUserId
    ? (await prisma.participant.count({
        where: { sessionId, userId: requestUserId },
      })) > 0
    : false;
  if (session.isPrivate && !isOwner && !isParticipant) notFound();

  if (session.status !== "OPEN") {
    redirect(`/sessions/${sessionId}/results`);
  }

  if (isParticipant) {
    redirect(`/sessions/${sessionId}/vote`);
  }

  redirect(`/sessions/join?code=${encodeURIComponent(session.joinCode)}`);
}
