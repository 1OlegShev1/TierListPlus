import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getCookieAuth } from "@/lib/auth";
import { type ConsensusTier, computeConsensus } from "@/lib/consensus";
import { prisma } from "@/lib/prisma";
import { tierConfigSchema } from "@/lib/validators";
import type { Item, SessionResult, TierConfig } from "@/types";
import { ResultsPageClient } from "./ResultsPageClient";
import { deriveBrowseQueryState } from "./resultsViewModel";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

interface ParticipantVote {
  tierKey: string;
  rankInTier: number;
  sessionItem: Item;
}

const SESSION_ITEM_SELECT = {
  id: true,
  label: true,
  imageUrl: true,
  sourceUrl: true,
  sourceProvider: true,
  sourceNote: true,
  sourceStartSec: true,
  sourceEndSec: true,
} as const;

function normalizeJoinCode(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

function buildParticipantTiers(
  votes: ParticipantVote[],
  tierConfig: TierConfig[],
): ConsensusTier[] {
  const grouped = new Map<string, ParticipantVote[]>();
  for (const tier of tierConfig) {
    grouped.set(tier.key, []);
  }
  for (const vote of votes) {
    const bucket = grouped.get(vote.tierKey);
    if (bucket) bucket.push(vote);
  }

  return tierConfig.map((tier) => ({
    ...tier,
    items: (grouped.get(tier.key) ?? [])
      .sort((a, b) => a.rankInTier - b.rankInTier)
      .map((vote) => ({
        ...vote.sessionItem,
        averageScore: 0,
        voteDistribution: {},
        voterNicknamesByTier: {},
        totalVotes: 0,
      })),
  }));
}

async function loadParticipantTiers({
  sessionId,
  participantId,
  tierConfig,
}: {
  sessionId: string;
  participantId: string;
  tierConfig: TierConfig[];
}) {
  const participantVotes = await prisma.tierVote.findMany({
    where: { participantId, sessionItem: { sessionId } },
    include: {
      sessionItem: {
        select: SESSION_ITEM_SELECT,
      },
    },
    orderBy: { rankInTier: "asc" },
  });

  return buildParticipantTiers(participantVotes, tierConfig);
}

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const { sessionId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedView: "browse" | "everyone" =
    typeof resolvedSearchParams.view === "string" && resolvedSearchParams.view === "browse"
      ? "browse"
      : "everyone";
  const requestedParticipantId =
    typeof resolvedSearchParams.participant === "string" ? resolvedSearchParams.participant : null;
  const requestedCompareParticipantId =
    typeof resolvedSearchParams.compare === "string" ? resolvedSearchParams.compare : null;
  const providedCode = normalizeJoinCode(
    typeof resolvedSearchParams.code === "string" ? resolvedSearchParams.code : null,
  );

  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const requestUserId = auth?.userId ?? null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      space: {
        select: {
          id: true,
          name: true,
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
        select: SESSION_ITEM_SELECT,
      },
      participants: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { tierVotes: true } } },
      },
    },
  });

  if (!session) notFound();

  const currentParticipant = requestUserId
    ? (session.participants.find((participant) => participant.userId === requestUserId) ?? null)
    : null;
  const isOwner = !!requestUserId && session.creatorId === requestUserId;
  const isParticipant = !!currentParticipant;
  const hasCodeResultsAccess =
    !session.space &&
    session.isPrivate &&
    session.status !== "OPEN" &&
    !!providedCode &&
    providedCode === session.joinCode;
  const isCodeOnlyViewer = hasCodeResultsAccess && !isOwner && !isParticipant;
  const canViewIndividualBallots = !isCodeOnlyViewer;
  const isSpaceOwner =
    !!requestUserId &&
    !!session.space &&
    (session.creatorId === requestUserId ||
      (Array.isArray(session.space.members) && session.space.members[0]?.role === "OWNER"));

  if (session.space) {
    const isSpaceMember = Array.isArray(session.space.members) && session.space.members.length > 0;
    if (session.space.visibility === "PRIVATE" && !isSpaceMember) {
      notFound();
    }
  } else if (session.isPrivate && !isOwner && !isParticipant && !hasCodeResultsAccess) {
    notFound();
  }

  const tierConfig = tierConfigSchema.parse(session.tierConfig);
  const votes = await prisma.tierVote.findMany({
    where: { sessionItem: { sessionId } },
    select: {
      participantId: true,
      participant: { select: { nickname: true } },
      sessionItemId: true,
      tierKey: true,
      rankInTier: true,
    },
  });

  const consensusTiers = computeConsensus(
    votes.map((vote) => ({
      participantId: vote.participantId,
      participantNickname: canViewIndividualBallots ? vote.participant.nickname : undefined,
      sessionItemId: vote.sessionItemId,
      tierKey: vote.tierKey,
      rankInTier: vote.rankInTier,
    })),
    tierConfig,
    session.items,
  );

  const totalItemCount = session.items.length;
  const participants = session.participants.map(({ _count, id, nickname, submittedAt }) => ({
    id,
    nickname,
    submittedAt: submittedAt?.toISOString() ?? null,
    hasSubmitted: _count.tierVotes > 0,
    hasSavedVotes: _count.tierVotes > 0,
    rankedItemCount: _count.tierVotes,
    totalItemCount,
    missingItemCount: Math.max(0, totalItemCount - _count.tierVotes),
    isComplete: totalItemCount > 0 && _count.tierVotes >= totalItemCount,
  }));
  const { initialView, participantId, compareParticipantId, compareEveryone } =
    deriveBrowseQueryState({
      canViewIndividualBallots,
      requestedView,
      requestedParticipantId,
      requestedCompareParticipantId,
    });
  let initialParticipantName: string | null = null;
  let initialParticipantTiers: ConsensusTier[] | null = null;
  let initialParticipantError: string | null = null;
  let initialCompareParticipantName: string | null = null;
  let initialCompareParticipantTiers: ConsensusTier[] | null = null;
  let initialCompareParticipantError: string | null = null;

  if (participantId) {
    const selectedParticipant = participants.find(
      (participant) => participant.id === participantId,
    );
    if (!selectedParticipant) {
      initialParticipantError = "Couldn't load that ballot.";
    } else {
      initialParticipantName = selectedParticipant.nickname;
      initialParticipantTiers = await loadParticipantTiers({
        sessionId,
        participantId,
        tierConfig,
      });
    }
  }

  if (participantId && compareParticipantId && !initialParticipantError) {
    const comparedParticipant = participants.find(
      (participant) => participant.id === compareParticipantId,
    );

    if (!comparedParticipant) {
      initialCompareParticipantError = "Couldn't load that comparison.";
    } else {
      initialCompareParticipantName = comparedParticipant.nickname;
      initialCompareParticipantTiers = await loadParticipantTiers({
        sessionId,
        participantId: compareParticipantId,
        tierConfig,
      });
    }
  }

  const sessionResult: SessionResult = {
    creatorId: session.creatorId,
    status: session.status,
    name: session.name,
    spaceId: session.space?.id ?? null,
    spaceName: session.space?.name ?? null,
    joinCode: session.joinCode,
    canManageSession: isOwner || isSpaceOwner,
    currentParticipantId: currentParticipant?.id ?? null,
    currentParticipantNickname: currentParticipant?.nickname ?? null,
    tierConfig,
    participants: canViewIndividualBallots ? participants : [],
  };

  return (
    <ResultsPageClient
      sessionId={sessionId}
      initialSession={sessionResult}
      initialConsensusTiers={consensusTiers}
      initialView={initialView}
      participantId={participantId}
      compareParticipantId={compareParticipantId}
      compareEveryone={compareEveryone}
      canViewIndividualBallots={canViewIndividualBallots}
      initialParticipantName={initialParticipantName}
      initialParticipantTiers={initialParticipantTiers}
      initialParticipantError={initialParticipantError}
      initialCompareParticipantName={initialCompareParticipantName}
      initialCompareParticipantTiers={initialCompareParticipantTiers}
      initialCompareParticipantError={initialCompareParticipantError}
    />
  );
}
