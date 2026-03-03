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

export default async function VotesPage() {
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;
  const sessionInclude = {
    template: { select: { name: true, isHidden: true } },
    items: {
      take: 4,
      orderBy: { sortOrder: "asc" },
      select: { id: true, imageUrl: true, label: true },
    },
    _count: { select: { participants: true, items: true } },
  } as const;

  const [liveVotes, finishedVotes, publicVotes] = await Promise.all([
    userId
      ? prisma.session.findMany({
          where: {
            status: "OPEN",
            OR: [{ creatorId: userId }, { participants: { some: { userId } } }],
          },
          include: sessionInclude,
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    userId
      ? prisma.session.findMany({
          where: {
            status: { not: "OPEN" },
            OR: [{ creatorId: userId }, { participants: { some: { userId } } }],
          },
          include: sessionInclude,
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.session.findMany({
      where: userId
        ? {
            isPrivate: false,
            NOT: {
              OR: [{ creatorId: userId }, { participants: { some: { userId } } }],
            },
          }
        : { isPrivate: false },
      include: sessionInclude,
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
  ]);
  const isEmpty = liveVotes.length === 0 && finishedVotes.length === 0 && publicVotes.length === 0;

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
          {liveVotes.length > 0 && (
            <VotesSection
              title="Active Votes"
              subtitle="Votes you started or joined that are still open."
              votes={liveVotes}
              viewer={userId ? "participant" : "browser"}
              ownerUserId={userId}
            />
          )}

          {finishedVotes.length > 0 && (
            <VotesSection
              title="Finished Votes"
              subtitle="Votes you started or joined that are done."
              votes={finishedVotes}
              viewer={userId ? "participant" : "browser"}
              ownerUserId={userId}
            />
          )}

          {publicVotes.length > 0 && (
            <VotesSection
              title="Public Votes"
              subtitle="Public votes from other people you can join or look through."
              votes={publicVotes}
              viewer="browser"
              ownerUserId={userId}
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
}: {
  title: string;
  subtitle: string;
  votes: VoteListItem[];
  viewer: VoteViewer;
  ownerUserId: string | null;
}) {
  return (
    <section>
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="space-y-4">
        {votes.map((vote) => (
          <VoteRow key={vote.id} vote={vote} viewer={resolveViewer(vote, viewer, ownerUserId)} />
        ))}
      </div>
    </section>
  );
}

function VoteRow({ vote, viewer }: { vote: VoteListItem; viewer: VoteViewer }) {
  const { chips, meta } = buildVoteDisplay({
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

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600 sm:flex-row sm:items-center">
      <Link href={`/sessions/${vote.id}`} className="min-w-0 flex-1">
        <VotePreviewSummary title={vote.name} meta={meta} items={vote.items} chips={chips} />
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={vote.status} />
        <Link href={action.href} className={buttonVariants.secondary}>
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
