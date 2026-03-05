import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canManageSessionItems } from "@/lib/api-helpers";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tierConfigSchema } from "@/lib/validators";
import type { SessionData } from "@/types";
import { VotePageClient } from "./VotePageClient";

export const dynamic = "force-dynamic";

const resultsLinkClassName =
  "inline-flex h-10 items-center justify-center rounded-lg border border-amber-500/60 bg-amber-500/10 px-4 text-sm font-medium text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-500/15 hover:text-amber-200";

interface ExistingVoteRow {
  tierKey: string;
  rankInTier: number;
  sessionItemId: string;
}

function buildSeededTiers(votes: ExistingVoteRow[]): Record<string, string[]> {
  const grouped = new Map<string, ExistingVoteRow[]>();
  for (const vote of votes) {
    const bucket = grouped.get(vote.tierKey) ?? [];
    bucket.push(vote);
    grouped.set(vote.tierKey, bucket);
  }

  const seeded: Record<string, string[]> = {};
  for (const [tierKey, tierVotes] of grouped.entries()) {
    seeded[tierKey] = tierVotes
      .sort((a, b) => a.rankInTier - b.rankInTier)
      .map((vote) => vote.sessionItemId);
  }

  return seeded;
}

export default async function VotePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const requestUserId = auth?.userId ?? null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      template: { select: { isHidden: true } },
      space: {
        select: {
          id: true,
          name: true,
          creatorId: true,
          visibility: true,
          members: requestUserId
            ? {
                where: { userId: requestUserId },
                select: { role: true },
                take: 1,
              }
            : false,
        },
      },
      items: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, label: true, imageUrl: true },
      },
    },
  });

  if (!session) notFound();

  const currentParticipant = requestUserId
    ? await prisma.participant.findFirst({
        where: { sessionId, userId: requestUserId },
        select: { id: true, nickname: true },
        orderBy: { createdAt: "asc" },
      })
    : null;

  const isOwner = !!requestUserId && session.creatorId === requestUserId;
  const isParticipant = !!currentParticipant;
  const spaceMember = Array.isArray(session.space?.members) ? session.space.members[0] : null;
  const isSpaceMember = !!spaceMember;
  const isSpaceOwner =
    !!requestUserId &&
    !!session.space &&
    (session.space.creatorId === requestUserId || spaceMember?.role === "OWNER");
  const canManageSession = isOwner || isSpaceOwner;

  if (session.space) {
    if (session.space.visibility === "PRIVATE" && !isSpaceMember) {
      notFound();
    }
  } else if (session.isPrivate && !isOwner && !isParticipant) {
    notFound();
  }

  if (!currentParticipant) {
    if (session.status !== "OPEN") {
      redirect(`/sessions/${sessionId}/results`);
    }
    redirect(`/sessions/join?code=${encodeURIComponent(session.joinCode)}`);
  }

  if (session.status !== "OPEN") {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <p className="text-lg text-neutral-400">This session is no longer accepting votes</p>
        <Link href={`/sessions/${sessionId}/results`} className={resultsLinkClassName}>
          View Results
        </Link>
      </div>
    );
  }

  const existingVotes = await prisma.tierVote.findMany({
    where: { participantId: currentParticipant.id, sessionItem: { sessionId } },
    select: {
      tierKey: true,
      rankInTier: true,
      sessionItemId: true,
    },
  });

  const sessionData: SessionData = {
    id: session.id,
    name: session.name,
    spaceId: session.space?.id ?? null,
    spaceName: session.space?.name ?? null,
    joinCode: session.joinCode,
    status: session.status,
    creatorId: session.creatorId,
    isPrivate: session.isPrivate,
    isLocked: session.isLocked,
    templateIsHidden: session.template.isHidden,
    canManageSession,
    canManageItems: canManageSessionItems(
      session.template.isHidden,
      session.creatorId,
      requestUserId,
      isSpaceOwner,
    ),
    tierConfig: tierConfigSchema.parse(session.tierConfig),
    items: session.items,
    currentParticipantId: currentParticipant.id,
    currentParticipantNickname: currentParticipant.nickname,
  };

  return (
    <VotePageClient
      sessionId={sessionId}
      session={sessionData}
      resolvedParticipantId={currentParticipant.id}
      seededTiers={buildSeededTiers(existingVotes)}
      currentUserId={requestUserId}
    />
  );
}
