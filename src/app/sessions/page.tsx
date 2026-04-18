import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import Link from "next/link";
import { CloseVoteButton } from "@/components/sessions/CloseVoteButton";
import { DeleteVoteButton } from "@/components/sessions/DeleteVoteButton";
import { ReopenVoteButton } from "@/components/sessions/ReopenVoteButton";
import { ShareVoteButton } from "@/components/sessions/ShareVoteButton";
import {
  VOTE_CARD_BOTTOM_ACTIONS_CLASS,
  VOTE_CARD_HEADER_CLASS,
  VOTE_CARD_SHELL_CLASS,
  VOTE_CARD_SUMMARY_LINK_CLASS,
  VOTE_CARD_TOP_ACTIONS_CLASS,
} from "@/components/sessions/voteCardClasses";
import { buildMobileVoteMetaLine } from "@/components/sessions/voteCardPresentation";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VotePreviewSummary } from "@/components/ui/VotePreviewSummary";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSessionCardInclude } from "@/lib/session-query";
import { buildVoteDisplay, getVoteAction, type VoteViewer } from "@/lib/vote-display";

export const dynamic = "force-dynamic";

const ACTIVE_VOTES_PAGE_SIZE = 20;
const HISTORY_VOTES_PAGE_SIZE = 20;
const PUBLIC_VOTES_PAGE_SIZE = 12;
const MOBILE_ACTION_BUTTON_CLASS = "!h-9 !justify-center !px-2.5 !py-0 !text-xs";
const DESKTOP_ACTION_BUTTON_CLASS = "!h-10 !justify-center !px-4 !py-0 !text-sm";

type SearchParams = Record<string, string | string[] | undefined>;

interface VoteListItem {
  id: string;
  name: string;
  joinCode: string;
  status: string;
  updatedAt: Date;
  creatorId: string | null;
  isPrivate: boolean;
  isLocked: boolean;
  template: { name: string; isHidden: boolean };
  items: { id: string; imageUrl: string; label: string }[];
  _count: { participants: number; items: number };
}

interface VoteSectionData {
  votes: VoteListItem[];
  hasMore: boolean;
  hasPrevious: boolean;
  page: number;
}

const sessionInclude = buildSessionCardInclude(4);

export default async function VotesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;
  const isAdmin = auth?.role === "ADMIN";
  const activePage = readPageParam(resolvedSearchParams.active);
  const historyPage = readPageParam(resolvedSearchParams.history);
  const discoverPage = readPageParam(resolvedSearchParams.discover);

  const [liveVotesSection, finishedVotesSection, publicVotesSection] = await Promise.all([
    userId
      ? loadVotesSection({
          page: activePage,
          pageSize: ACTIVE_VOTES_PAGE_SIZE,
          where: {
            spaceId: null,
            status: "OPEN",
            OR: [{ creatorId: userId }, { participants: { some: { userId } } }],
          },
        })
      : Promise.resolve(emptyVoteSection(activePage)),
    userId
      ? loadVotesSection({
          page: historyPage,
          pageSize: HISTORY_VOTES_PAGE_SIZE,
          where: {
            spaceId: null,
            status: { not: "OPEN" },
            OR: [{ creatorId: userId }, { participants: { some: { userId } } }],
          },
        })
      : Promise.resolve(emptyVoteSection(historyPage)),
    loadVotesSection({
      page: discoverPage,
      pageSize: PUBLIC_VOTES_PAGE_SIZE,
      where: userId
        ? {
            spaceId: null,
            status: "OPEN",
            isPrivate: false,
            isModeratedHidden: false,
            NOT: {
              OR: [{ creatorId: userId }, { participants: { some: { userId } } }],
            },
          }
        : { spaceId: null, status: "OPEN", isPrivate: false, isModeratedHidden: false },
    }),
  ]);
  const progressVoteIds = userId
    ? [
        ...new Set(
          [...liveVotesSection.votes, ...finishedVotesSection.votes].map((vote) => vote.id),
        ),
      ]
    : [];
  const userRankedCountBySessionId =
    userId && progressVoteIds.length > 0
      ? await loadUserRankedCountBySession(progressVoteIds, userId)
      : new Map<string, number>();
  const showLiveSection =
    !!userId && (liveVotesSection.votes.length > 0 || liveVotesSection.hasPrevious);
  const showFinishedSection =
    !!userId && (finishedVotesSection.votes.length > 0 || finishedVotesSection.hasPrevious);
  const showPublicSection = publicVotesSection.votes.length > 0 || publicVotesSection.hasPrevious;
  const isEmpty = !showLiveSection && !showFinishedSection && !showPublicSection;

  return (
    <div>
      <PageHeader
        title="Rankings"
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0">
            <Link href="/sessions/join" className={buttonVariants.secondary}>
              Join Ranking
            </Link>
            <Link href="/sessions/new" className={buttonVariants.primary}>
              + Start Ranking
            </Link>
          </div>
        }
      />

      {isEmpty ? (
        <EmptyState
          title="No rankings yet"
          description="Make a list first, then start the ranking chaos"
        />
      ) : (
        <div className="space-y-10">
          {showLiveSection && (
            <VotesSection
              title="Active Rankings"
              subtitle="Rankings you started or joined that are still open."
              votes={liveVotesSection.votes}
              viewer="participant"
              ownerUserId={userId}
              canDeleteOverride={isAdmin}
              userRankedCountBySessionId={userRankedCountBySessionId}
              pagination={buildPagination({
                searchParams: resolvedSearchParams,
                key: "active",
                page: liveVotesSection.page,
                hasMore: liveVotesSection.hasMore,
                hasPrevious: liveVotesSection.hasPrevious,
              })}
            />
          )}

          {showFinishedSection && (
            <VotesSection
              title="Finished Rankings"
              subtitle="Rankings you started or joined that are done."
              votes={finishedVotesSection.votes}
              viewer="participant"
              ownerUserId={userId}
              canDeleteOverride={isAdmin}
              userRankedCountBySessionId={userRankedCountBySessionId}
              pagination={buildPagination({
                searchParams: resolvedSearchParams,
                key: "history",
                page: finishedVotesSection.page,
                hasMore: finishedVotesSection.hasMore,
                hasPrevious: finishedVotesSection.hasPrevious,
              })}
            />
          )}

          {showPublicSection && (
            <VotesSection
              title="Public Rankings"
              subtitle="Public rankings from other people you can jump into right now."
              votes={publicVotesSection.votes}
              viewer="browser"
              ownerUserId={userId}
              canDeleteOverride={isAdmin}
              userRankedCountBySessionId={userRankedCountBySessionId}
              pagination={buildPagination({
                searchParams: resolvedSearchParams,
                key: "discover",
                page: publicVotesSection.page,
                hasMore: publicVotesSection.hasMore,
                hasPrevious: publicVotesSection.hasPrevious,
              })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function VotesSection({
  title,
  subtitle,
  votes,
  viewer,
  ownerUserId,
  canDeleteOverride,
  userRankedCountBySessionId,
  pagination,
}: {
  title: string;
  subtitle: string;
  votes: VoteListItem[];
  viewer: VoteViewer;
  ownerUserId: string | null;
  canDeleteOverride: boolean;
  userRankedCountBySessionId: Map<string, number>;
  pagination: {
    previousHref: string | null;
    nextHref: string | null;
    pageLabel: string;
  };
}) {
  return (
    <section>
      <SectionHeader title={title} subtitle={subtitle} />
      {votes.length > 0 ? (
        <div className="space-y-4">
          {votes.map((vote) => (
            <VoteRow
              key={vote.id}
              vote={vote}
              canDeleteOverride={canDeleteOverride}
              viewer={resolveViewer(vote, viewer, ownerUserId)}
              rankedItemCountForUser={userRankedCountBySessionId.get(vote.id) ?? null}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-soft-contrast)] px-5 py-4 text-sm text-[var(--fg-muted)]">
          Nothing else here right now.
        </div>
      )}
      {(pagination.previousHref || pagination.nextHref) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {pagination.previousHref && (
            <Link
              href={pagination.previousHref}
              className={`${buttonVariants.secondary} !rounded-xl !px-3 !py-1.5 !text-sm !font-medium sm:!px-3 sm:!py-1.5 sm:!text-sm`}
            >
              Newer
            </Link>
          )}
          {pagination.nextHref && (
            <Link
              href={pagination.nextHref}
              className={`${buttonVariants.secondary} !rounded-xl !px-3 !py-1.5 !text-sm !font-medium sm:!px-3 sm:!py-1.5 sm:!text-sm`}
            >
              More
            </Link>
          )}
          <p className="text-sm text-[var(--fg-muted)]">{pagination.pageLabel}</p>
        </div>
      )}
    </section>
  );
}

function VoteRow({
  vote,
  canDeleteOverride,
  viewer,
  rankedItemCountForUser,
}: {
  vote: VoteListItem;
  canDeleteOverride: boolean;
  viewer: VoteViewer;
  rankedItemCountForUser: number | null;
}) {
  const { chips, detailsLabel, secondaryLabel, sourceLabel } = buildVoteDisplay({
    viewer,
    isPrivate: vote.isPrivate,
    isLocked: vote.isLocked,
    status: vote.status,
    updatedAt: vote.updatedAt,
    itemCount: vote._count.items,
    participantCount: vote._count.participants,
    listName: vote.template.name,
    listHidden: vote.template.isHidden,
  });
  const hasCompletedRanking =
    vote._count.items > 0 &&
    rankedItemCountForUser !== null &&
    rankedItemCountForUser >= vote._count.items;
  const action = getVoteAction({
    viewer,
    status: vote.status,
    isPrivate: vote.isPrivate,
    isLocked: vote.isLocked,
    sessionId: vote.id,
    hasCompletedRanking,
  });
  const mobileMetaLabel = buildMobileVoteMetaLine({
    itemCount: vote._count.items,
    participantCount: vote._count.participants,
    updatedAt: vote.updatedAt,
  });
  const mobileActionLabel =
    action.label === "Resume"
      ? "Go"
      : action.label === "Results"
        ? "Results"
        : action.label === "Join"
          ? "Join"
          : action.label;
  const actionButtonVariant =
    action.label === "Resume" ? buttonVariants.primary : buttonVariants.accent;

  return (
    <>
      <div className={`${VOTE_CARD_SHELL_CLASS} sm:hidden`}>
        <div className={VOTE_CARD_HEADER_CLASS}>
          <Link href={action.href} className={VOTE_CARD_SUMMARY_LINK_CLASS}>
            <VotePreviewSummary
              title={vote.name}
              detailsLabel={detailsLabel}
              secondaryLabel={secondaryLabel}
              mobileMetaLabel={mobileMetaLabel}
              items={vote.items}
              chips={chips}
              sourceLabel={sourceLabel}
            />
          </Link>
          <div className={VOTE_CARD_TOP_ACTIONS_CLASS}>
            <StatusBadge status={vote.status} />
          </div>
        </div>
        <div className={VOTE_CARD_BOTTOM_ACTIONS_CLASS}>
          <ShareVoteButton
            joinCode={vote.joinCode}
            creatorId={vote.creatorId}
            status={vote.status}
            isLocked={vote.isLocked}
            label="Share"
            iconOnly
            className={MOBILE_ACTION_BUTTON_CLASS}
          />
          <Link
            href={action.href}
            className={`${actionButtonVariant} ${MOBILE_ACTION_BUTTON_CLASS}`}
          >
            {mobileActionLabel}
          </Link>
          <CloseVoteButton
            sessionId={vote.id}
            creatorId={vote.creatorId}
            status={vote.status}
            label="End"
            variant="secondary"
            className={MOBILE_ACTION_BUTTON_CLASS}
          />
          <ReopenVoteButton
            sessionId={vote.id}
            creatorId={vote.creatorId}
            status={vote.status}
            label="Reopen"
            className={MOBILE_ACTION_BUTTON_CLASS}
          />
          <DeleteVoteButton
            sessionId={vote.id}
            creatorId={vote.creatorId}
            canDeleteOverride={canDeleteOverride}
            className="shrink-0"
          />
        </div>
      </div>

      <div className={`${VOTE_CARD_SHELL_CLASS} hidden sm:flex sm:items-center sm:gap-5`}>
        <Link href={action.href} className="min-w-0 flex-1">
          <VotePreviewSummary
            title={vote.name}
            detailsLabel={detailsLabel}
            secondaryLabel={secondaryLabel}
            items={vote.items}
            chips={chips}
            sourceLabel={sourceLabel}
          />
        </Link>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <StatusBadge status={vote.status} />
          <ShareVoteButton
            joinCode={vote.joinCode}
            creatorId={vote.creatorId}
            status={vote.status}
            isLocked={vote.isLocked}
            className={DESKTOP_ACTION_BUTTON_CLASS}
          />
          <Link
            href={action.href}
            className={`${actionButtonVariant} ${DESKTOP_ACTION_BUTTON_CLASS}`}
          >
            {action.label}
          </Link>
          <CloseVoteButton
            sessionId={vote.id}
            creatorId={vote.creatorId}
            status={vote.status}
            label="Close ranking"
            variant="secondary"
            className={DESKTOP_ACTION_BUTTON_CLASS}
          />
          <ReopenVoteButton
            sessionId={vote.id}
            creatorId={vote.creatorId}
            status={vote.status}
            label="Reopen ranking"
            className={DESKTOP_ACTION_BUTTON_CLASS}
          />
          <DeleteVoteButton
            sessionId={vote.id}
            creatorId={vote.creatorId}
            canDeleteOverride={canDeleteOverride}
            className="shrink-0"
          />
        </div>
      </div>
    </>
  );
}

function resolveViewer(
  vote: VoteListItem,
  fallback: VoteViewer,
  userId: string | null,
): VoteViewer {
  if (userId && vote.creatorId === userId) {
    return "owner";
  }

  return fallback;
}

async function loadVotesSection({
  where,
  page,
  pageSize,
}: {
  where: Prisma.SessionWhereInput;
  page: number;
  pageSize: number;
}): Promise<VoteSectionData> {
  const votes = await prisma.session.findMany({
    where,
    include: sessionInclude,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
  });

  return {
    votes: votes.slice(0, pageSize),
    hasMore: votes.length > pageSize,
    hasPrevious: page > 1,
    page,
  };
}

async function loadUserRankedCountBySession(sessionIds: string[], userId: string) {
  const participants = await prisma.participant.findMany({
    where: { userId, sessionId: { in: sessionIds } },
    select: {
      sessionId: true,
      _count: { select: { tierVotes: true } },
    },
  });

  return new Map(
    participants.map((participant) => [participant.sessionId, participant._count.tierVotes]),
  );
}

function emptyVoteSection(page: number): VoteSectionData {
  return {
    votes: [],
    hasMore: false,
    hasPrevious: page > 1,
    page,
  };
}

function readPageParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function buildPagination({
  searchParams,
  key,
  page,
  hasMore,
  hasPrevious,
}: {
  searchParams: SearchParams;
  key: "active" | "history" | "discover";
  page: number;
  hasMore: boolean;
  hasPrevious: boolean;
}) {
  return {
    previousHref: hasPrevious ? buildPageHref(searchParams, key, page - 1) : null,
    nextHref: hasMore ? buildPageHref(searchParams, key, page + 1) : null,
    pageLabel: `Page ${page}`,
  };
}

function buildPageHref(
  searchParams: SearchParams,
  key: "active" | "history" | "discover",
  page: number,
) {
  const params = new URLSearchParams();

  for (const [entryKey, entryValue] of Object.entries(searchParams)) {
    if (entryKey === key || entryValue == null) continue;
    if (Array.isArray(entryValue)) {
      for (const value of entryValue) {
        params.append(entryKey, value);
      }
      continue;
    }
    params.set(entryKey, entryValue);
  }

  if (page > 1) {
    params.set(key, String(page));
  }

  const query = params.toString();
  return query ? `/sessions?${query}` : "/sessions";
}
