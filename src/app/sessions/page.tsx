import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import Link from "next/link";
import { DeleteVoteButton } from "@/components/sessions/DeleteVoteButton";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VotePreviewSummary } from "@/components/ui/VotePreviewSummary";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildVoteDisplay, getVoteAction, type VoteViewer } from "@/lib/vote-display";

export const dynamic = "force-dynamic";

const ACTIVE_VOTES_PAGE_SIZE = 20;
const HISTORY_VOTES_PAGE_SIZE = 20;
const PUBLIC_VOTES_PAGE_SIZE = 12;

type SearchParams = Record<string, string | string[] | undefined>;

interface VoteListItem {
  id: string;
  name: string;
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

const sessionInclude = {
  template: { select: { name: true, isHidden: true } },
  items: {
    take: 4,
    orderBy: { sortOrder: "asc" },
    select: { id: true, imageUrl: true, label: true },
  },
  _count: { select: { participants: true, items: true } },
} as const;

export default async function VotesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;
  const activePage = readPageParam(resolvedSearchParams.active);
  const historyPage = readPageParam(resolvedSearchParams.history);
  const discoverPage = readPageParam(resolvedSearchParams.discover);

  const [liveVotesSection, finishedVotesSection, publicVotesSection] = await Promise.all([
    userId
      ? loadVotesSection({
          page: activePage,
          pageSize: ACTIVE_VOTES_PAGE_SIZE,
          where: {
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
            status: "OPEN",
            isPrivate: false,
            NOT: {
              OR: [{ creatorId: userId }, { participants: { some: { userId } } }],
            },
          }
        : { status: "OPEN", isPrivate: false },
    }),
  ]);
  const showLiveSection =
    !!userId && (liveVotesSection.votes.length > 0 || liveVotesSection.hasPrevious);
  const showFinishedSection =
    !!userId && (finishedVotesSection.votes.length > 0 || finishedVotesSection.hasPrevious);
  const showPublicSection = publicVotesSection.votes.length > 0 || publicVotesSection.hasPrevious;
  const isEmpty = !showLiveSection && !showFinishedSection && !showPublicSection;

  return (
    <div>
      <PageHeader
        title="Votes"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/sessions/join" className={buttonVariants.secondary}>
              Join a Vote
            </Link>
            <Link href="/sessions/new" className={buttonVariants.primary}>
              + Start a Vote
            </Link>
          </div>
        }
      />

      {isEmpty ? (
        <EmptyState
          title="No votes yet"
          description="Make a list first, then start the ranking chaos"
        />
      ) : (
        <div className="space-y-10">
          {showLiveSection && (
            <VotesSection
              title="Active Votes"
              subtitle="Votes you started or joined that are still open."
              votes={liveVotesSection.votes}
              viewer="participant"
              ownerUserId={userId}
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
              title="Finished Votes"
              subtitle="Votes you started or joined that are done."
              votes={finishedVotesSection.votes}
              viewer="participant"
              ownerUserId={userId}
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
              title="Public Votes"
              subtitle="Public votes from other people you can jump into right now."
              votes={publicVotesSection.votes}
              viewer="browser"
              ownerUserId={userId}
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
  pagination,
}: {
  title: string;
  subtitle: string;
  votes: VoteListItem[];
  viewer: VoteViewer;
  ownerUserId: string | null;
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
            <VoteRow key={vote.id} vote={vote} viewer={resolveViewer(vote, viewer, ownerUserId)} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/40 px-5 py-4 text-sm text-neutral-500">
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
          <p className="text-sm text-neutral-500">{pagination.pageLabel}</p>
        </div>
      )}
    </section>
  );
}

function VoteRow({ vote, viewer }: { vote: VoteListItem; viewer: VoteViewer }) {
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
  const action = getVoteAction({
    viewer,
    status: vote.status,
    isPrivate: vote.isPrivate,
    isLocked: vote.isLocked,
    sessionId: vote.id,
  });
  const showStatusBadge = vote.status !== "OPEN";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600 sm:flex-row sm:items-center sm:gap-5">
      <Link href={`/sessions/${vote.id}`} className="min-w-0 flex-1">
        <VotePreviewSummary
          title={vote.name}
          detailsLabel={detailsLabel}
          secondaryLabel={secondaryLabel}
          items={vote.items}
          chips={chips}
          sourceLabel={sourceLabel}
        />
      </Link>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {showStatusBadge && <StatusBadge status={vote.status} />}
        <Link href={action.href} className={`${buttonVariants.secondary} sm:px-6`}>
          {action.label}
        </Link>
        <DeleteVoteButton sessionId={vote.id} creatorId={vote.creatorId} />
      </div>
    </div>
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
