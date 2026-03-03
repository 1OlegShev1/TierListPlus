import { cookies } from "next/headers";
import Link from "next/link";
import { DeleteVoteButton } from "@/components/sessions/DeleteVoteButton";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ItemPreview } from "@/components/ui/ItemPreview";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface VoteListItem {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  creatorId: string | null;
  template: { name: string; isHidden: boolean };
  items: { id: string; imageUrl: string; label: string }[];
  _count: { participants: number };
}

function getVoteMeta(list: { name: string; isHidden: boolean }, participantCount: number) {
  return list.isHidden
    ? `${participantCount} participants`
    : `${list.name} · ${participantCount} participants`;
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
    _count: { select: { participants: true } },
  } as const;

  const [liveVotes, finishedVotes, publicVotes] = await Promise.all([
    userId
      ? prisma.session.findMany({
          where: {
            status: "OPEN",
            OR: [{ creatorId: userId }, { participants: { some: { userId } } }],
          },
          include: sessionInclude,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    userId
      ? prisma.session.findMany({
          where: {
            status: { not: "OPEN" },
            OR: [{ creatorId: userId }, { participants: { some: { userId } } }],
          },
          include: sessionInclude,
          orderBy: { createdAt: "desc" },
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
      orderBy: { createdAt: "desc" },
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
              title="Live Now"
              subtitle="Votes you started or jumped into and can still keep pushing."
              votes={liveVotes}
            />
          )}

          {finishedVotes.length > 0 && (
            <VotesSection
              title="Wrapped Up"
              subtitle="Past votes you were part of, ready for replays and second-guessing."
              votes={finishedVotes}
            />
          )}

          {publicVotes.length > 0 && (
            <VotesSection
              title="Public to Browse"
              subtitle="Open or finished public votes from other people."
              votes={publicVotes}
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
}: {
  title: string;
  subtitle: string;
  votes: VoteListItem[];
}) {
  return (
    <section>
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-neutral-200 sm:text-2xl">{title}</h2>
        <p className="mt-2 text-base text-neutral-500">{subtitle}</p>
      </div>
      <div className="space-y-4">
        {votes.map((vote) => (
          <VoteRow key={vote.id} vote={vote} />
        ))}
      </div>
    </section>
  );
}

function VoteRow({ vote }: { vote: VoteListItem }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/95 p-5 transition-colors hover:border-neutral-600 sm:flex-row sm:items-center">
      <Link href={`/sessions/${vote.id}`} className="flex min-w-0 flex-1 items-center gap-4">
        <ItemPreview items={vote.items} variant="strip" />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-neutral-100">{vote.name}</h3>
          <p className="mt-1 text-sm text-neutral-500">
            {getVoteMeta(vote.template, vote._count.participants)} &middot;{" "}
            {formatDate(vote.createdAt)}
          </p>
        </div>
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={vote.status} />
        <Link href={`/sessions/${vote.id}/results`} className={buttonVariants.secondary}>
          Results
        </Link>
        <DeleteVoteButton sessionId={vote.id} creatorId={vote.creatorId} />
      </div>
    </div>
  );
}
