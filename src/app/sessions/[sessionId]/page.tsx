import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const requestUserId = auth?.userId ?? null;
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
