"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPreviewCard } from "@/components/ui/ListPreviewCard";
import { Loading } from "@/components/ui/Loading";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VotePreviewSummary } from "@/components/ui/VotePreviewSummary";
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
    <div className="space-y-10 pt-2 sm:pt-3">
      <section className="rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-950 p-5 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400/80">
          TierList+
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
          Rank anything with your friends
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-neutral-400 sm:text-lg">
          Make a tier list, start a vote, and jump back into the latest chaos.
        </p>
        <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
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
      <div className="space-y-10 px-5 sm:px-8">
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
            <SectionHeader title="Keep Going" actionHref="/sessions" actionLabel="See all votes" />
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
            <SectionHeader title="Your Lists" actionHref="/templates" actionLabel="See all lists" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listPreview.map((t) => (
                <Link key={t.id} href={`/templates/${t.id}`} className="block">
                  <ListPreviewCard
                    title={t.name}
                    meta={`${t._count.items} picks · ${formatDate(t.createdAt)}`}
                    items={t.items}
                    className="transition-colors hover:border-neutral-600"
                  />
                </Link>
              ))}
            </div>
          </section>
        )}

        {fromMyListsPreview.length > 0 && (
          <section>
            <SectionHeader
              title="From Your Lists"
              subtitle="Public votes other people started using your tier lists."
              actionHref="/sessions"
              actionLabel="See all votes"
            />
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
      className="flex items-start justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600"
    >
      <VotePreviewSummary title={vote.name} meta={metaParts.join(" · ")} items={vote.items} />
      <div className="shrink-0 pt-0.5">
        <StatusBadge status={vote.status} />
      </div>
    </Link>
  );
}
