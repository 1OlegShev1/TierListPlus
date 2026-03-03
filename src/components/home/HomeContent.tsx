"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ItemPreview } from "@/components/ui/ItemPreview";
import { Loading } from "@/components/ui/Loading";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useUser } from "@/hooks/useUser";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

interface ListSummary {
  id: string;
  name: string;
  createdAt: string;
  items: { id: string; imageUrl: string; label: string }[];
  _count: { items: number };
}

interface VoteSummary {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  template: { name: string; isHidden: boolean };
  items: { id: string; imageUrl: string; label: string }[];
  _count: { participants: number };
}

interface HomeData {
  myTemplates: ListSummary[];
  mySessions: VoteSummary[];
  participatedSessions: VoteSummary[];
  fromMyTemplates: VoteSummary[];
}

type HomeVoteSummary = VoteSummary & { involvement: "started" | "joined" };
const HOME_SECTION_LIMIT = 4;

export function HomeContent() {
  const { userId, isLoading: userLoading } = useUser();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userLoading) return;
    if (!userId) {
      setLoading(false);
      return;
    }
    apiFetch<HomeData>("/api/home")
      .then(setData)
      .finally(() => setLoading(false));
  }, [userId, userLoading]);

  if (userLoading || loading) return <Loading />;

  if (!data)
    return <EmptyState title="Could not load home" description="Please try refreshing the page" />;

  const myLists = data.myTemplates;
  const startedVotes = data.mySessions;
  const joinedVotes = data.participatedSessions;
  const votesFromMyLists = data.fromMyTemplates;
  const isEmpty = myLists.length === 0 && startedVotes.length === 0 && joinedVotes.length === 0;
  const keepGoingSessions: HomeVoteSummary[] = [
    ...startedVotes.map((vote) => ({ ...vote, involvement: "started" as const })),
    ...joinedVotes.map((vote) => ({ ...vote, involvement: "joined" as const })),
  ]
    .filter((vote) => vote.status === "OPEN")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const keepGoingPreview = keepGoingSessions.slice(0, HOME_SECTION_LIMIT);
  const listPreview = myLists.slice(0, HOME_SECTION_LIMIT);
  const fromMyListsPreview = votesFromMyLists.slice(0, HOME_SECTION_LIMIT);

  return (
    <div className="space-y-12">
      <section className="rounded-[2rem] border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-950 p-6 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400/80">
          TierList+
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
          Rank anything with your friends
        </h1>
        <p className="mt-4 max-w-3xl text-base text-neutral-400 sm:text-xl">
          Make a tier list, start a vote, and jump back into the latest chaos.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/sessions/new" className={buttonVariants.primary}>
              Start a Vote
            </Link>
            <Link href="/sessions/join" className={buttonVariants.secondary}>
              Join a Vote
            </Link>
          </div>
          <Link href="/templates/new" className={buttonVariants.secondary}>
            Make a Tier List
          </Link>
        </div>
      </section>
      <div className="space-y-12 px-1 sm:px-2">
        {isEmpty && (
          <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-950/50 px-6 py-10 text-center">
            <p className="text-xl font-medium text-neutral-200">Nothing cooking yet</p>
            <p className="mt-3 text-base text-neutral-500">
              Make a list or jump into a vote to get things moving.
            </p>
          </div>
        )}

        {keepGoingPreview.length > 0 && (
          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-neutral-200 sm:text-2xl">Keep Going</h2>
              <Link href="/sessions" className={`${buttonVariants.secondary} !px-4 !py-2 !text-sm`}>
                See all votes
              </Link>
            </div>
            <div className="space-y-4">
              {keepGoingPreview.map((vote) => (
                <VoteRow
                  key={`${vote.involvement}-${vote.id}`}
                  vote={vote}
                  contextLabel={
                    vote.involvement === "started" ? "You started this" : "You're already in"
                  }
                />
              ))}
            </div>
          </section>
        )}

        {listPreview.length > 0 && (
          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-neutral-200 sm:text-2xl">Your Lists</h2>
              <Link
                href="/templates"
                className={`${buttonVariants.secondary} !px-4 !py-2 !text-sm`}
              >
                See all lists
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listPreview.map((t) => (
                <Link
                  key={t.id}
                  href={`/templates/${t.id}`}
                  className="rounded-2xl border border-neutral-800 bg-neutral-900/95 p-5 transition-colors hover:border-neutral-600"
                >
                  <ItemPreview items={t.items} className="mb-4" />
                  <h3 className="text-lg font-semibold text-neutral-100">{t.name}</h3>
                  <p className="mt-2 text-sm text-neutral-500">
                    {t._count.items} picks &middot; {formatDate(t.createdAt)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {fromMyListsPreview.length > 0 && (
          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-neutral-200 sm:text-2xl">
                  From Your Lists
                </h2>
                <p className="mt-2 text-base text-neutral-500">
                  Public votes other people started using your tier lists.
                </p>
              </div>
              <Link href="/sessions" className={`${buttonVariants.secondary} !px-4 !py-2 !text-sm`}>
                See all votes
              </Link>
            </div>
            <div className="space-y-4">
              {fromMyListsPreview.map((vote) => (
                <VoteRow
                  key={`from-your-lists-${vote.id}`}
                  vote={vote}
                  contextLabel="Someone started this from one of your lists"
                />
              ))}
            </div>
          </section>
        )}

        {!isEmpty && keepGoingSessions.length === 0 && (
          <div className="rounded-3xl border border-neutral-800 bg-neutral-900 px-6 py-5">
            <p className="text-lg font-medium text-neutral-200">No live votes right now</p>
            <p className="mt-2 text-base text-neutral-500">
              Start a new one or browse your older battles in Votes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function VoteRow({ vote, contextLabel }: { vote: VoteSummary; contextLabel?: string }) {
  const voteMeta = vote.template.isHidden
    ? `${vote._count.participants} participants`
    : `${vote.template.name} · ${vote._count.participants} participants`;
  const metaParts = [contextLabel, voteMeta, formatDate(vote.createdAt)].filter(Boolean);

  return (
    <Link
      href={`/sessions/${vote.id}`}
      className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/95 p-5 transition-colors hover:border-neutral-600 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-4">
        <ItemPreview items={vote.items} variant="strip" />
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-neutral-100">{vote.name}</h3>
          <p className="mt-1 text-sm text-neutral-500">{metaParts.join(" · ")}</p>
        </div>
      </div>
      <StatusBadge status={vote.status} />
    </Link>
  );
}
