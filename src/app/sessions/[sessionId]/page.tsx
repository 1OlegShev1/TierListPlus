import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SessionLobby } from "@/components/sessions/SessionLobby";
import { prisma } from "@/lib/prisma";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/user-session";

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;
  const requestUserId = token ? verifyUserSessionToken(token) : null;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      template: { select: { name: true } },
      participants: { orderBy: { createdAt: "asc" } },
      items: { orderBy: { sortOrder: "asc" } },
      _count: { select: { participants: true } },
    },
  });

  if (!session) notFound();
  const isOwner = !!requestUserId && session.creatorId === requestUserId;
  const isParticipant =
    !!requestUserId && session.participants.some((p) => p.userId === requestUserId);
  if (session.isPrivate && !isOwner && !isParticipant) notFound();

  return <SessionLobby session={JSON.parse(JSON.stringify(session))} />;
}
