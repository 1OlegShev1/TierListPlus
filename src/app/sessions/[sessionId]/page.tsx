import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SessionLobby } from "@/components/sessions/SessionLobby";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
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

  return <SessionLobby session={JSON.parse(JSON.stringify(session))} />;
}
