"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShareVoteButton } from "@/components/sessions/ShareVoteButton";
import {
  VOTE_CARD_HEADER_CLASS,
  VOTE_CARD_SHELL_CLASS,
  VOTE_CARD_SUMMARY_LINK_CLASS,
  VOTE_CARD_TOP_ACTIONS_CLASS,
} from "@/components/sessions/voteCardClasses";
import { buildMobileVoteMetaLine } from "@/components/sessions/voteCardPresentation";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPreviewCard } from "@/components/ui/ListPreviewCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VotePreviewSummary } from "@/components/ui/VotePreviewSummary";
import { useUser } from "@/hooks/useUser";
import { apiFetch } from "@/lib/api-client";
import type { HomeData, HomeVoteSummary } from "@/lib/home-data";
import { formatDate } from "@/lib/utils";
import { buildVoteDisplay } from "@/lib/vote-display";

type HomeActivityVote = HomeVoteSummary & { involvement: "started" | "joined" };

export function HomeContent({ initialData = null }: { initialData?: HomeData | null }) {
  const { userId, isLoading: userLoading } = useUser();
  const [data, setData] = useState<HomeData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    if (data) {
      setLoading(false);
      return;
    }
    if (userLoading) return;
    if (!userId) {
      setLoading(false);
      return;
    }
    apiFetch<HomeData>("/api/home")
      .then(setData)
      .finally(() => setLoading(false));
  }, [data, userId, userLoading]);

  const myLists = data?.myTemplates ?? [];
  const startedVotes = data?.mySessions ?? [];
  const joinedVotes = data?.participatedSessions ?? [];
  const votesFromMyLists = data?.fromMyTemplates ?? [];
  const hasAnyActivity = data?.hasAnyActivity ?? false;
  const loadFailed = !loading && !userLoading && !data;
  const hasResolvedData = !!data;

  const isEmpty = myLists.length === 0 && !hasAnyActivity;
  const keepGoingSessions: HomeActivityVote[] = [
    ...startedVotes.map((vote) => ({ ...vote, involvement: "started" as const })),
    ...joinedVotes.map((vote) => ({ ...vote, involvement: "joined" as const })),
  ].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const keepGoingPreview = keepGoingSessions.slice(0, 4);
  const listPreview = myLists;
  const fromMyListsPreview = votesFromMyLists;
  const heroCtaClass =
    "min-w-0 w-full whitespace-nowrap !px-2 !py-2 !text-[0.72rem] sm:w-auto sm:!px-8 sm:!py-2.5 sm:!text-base max-[380px]:!px-1.5 max-[380px]:!py-1.5 max-[380px]:!text-[0.68rem]";

  return (
    <div className="space-y-8 pt-2 sm:space-y-10 sm:pt-3">
      <section className="rounded-3xl border border-[var(--border-subtle)] bg-[linear-gradient(135deg,var(--bg-surface),var(--bg-elevated),var(--bg-elevated))] p-4 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent-primary)]">
          TierList+
        </p>
        <h1 className="mt-2.5 text-[1.95rem] font-bold leading-[1.05] tracking-tight sm:mt-3 sm:text-5xl">
          Rank anything with your friends
        </h1>
        <p className="mt-2.5 max-w-2xl text-sm text-[var(--fg-muted)] sm:mt-3 sm:text-lg">
          Make a tier list, start a vote, and jump back into the latest chaos.
        </p>
        <div className="mt-6 grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-3">
          <Link href="/sessions/new" className={`${buttonVariants.primary} ${heroCtaClass}`}>
            <span className="sm:hidden">Start</span>
            <span className="hidden sm:inline">Start a Vote</span>
          </Link>
          <Link href="/sessions/join" className={`${buttonVariants.secondary} ${heroCtaClass}`}>
            <span className="sm:hidden">Join</span>
            <span className="hidden sm:inline">Join a Vote</span>
          </Link>
          <Link href="/templates/new" className={`${buttonVariants.secondary} ${heroCtaClass}`}>
            <span className="sm:hidden">New List</span>
            <span className="hidden sm:inline">Make a Tier List</span>
          </Link>
        </div>
      </section>
      <div className="space-y-10 px-5 sm:px-8">
        {loadFailed && (
          <EmptyState title="Could not load home" description="Please try refreshing the page" />
        )}

        {hasResolvedData && isEmpty && (
          <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-10 text-center">
            <p className="text-xl font-medium text-[var(--fg-primary)]">Nothing cooking yet</p>
            <p className="mt-3 text-base text-[var(--fg-muted)]">
              Make a list or jump into a vote to get things moving.
            </p>
          </div>
        )}

        {keepGoingPreview.length > 0 && (
          <section>
            <SectionHeader title="Keep Going" actionHref="/sessions" actionLabel="See all votes" />
            <div className="grid gap-4 md:grid-cols-2">
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
                <Link key={t.id} href={`/templates/${t.id}`} className="block h-full">
                  <ListPreviewCard
                    title={t.name}
                    detailsLabel={`${t._count.items} picks`}
                    secondaryLabel={formatDate(t.createdAt)}
                    items={t.items}
                    className="transition-colors hover:border-[var(--border-strong)]"
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
            <div className="grid gap-4 md:grid-cols-2">
              {fromMyListsPreview.map((vote) => (
                <VoteRow
                  key={`from-your-lists-${vote.id}`}
                  vote={vote}
                  contextLabel="Started from one of your lists"
                />
              ))}
            </div>
          </section>
        )}

        {hasResolvedData && !isEmpty && keepGoingSessions.length === 0 && (
          <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-5">
            <p className="text-lg font-medium text-[var(--fg-primary)]">No live votes right now</p>
            <p className="mt-2 text-base text-[var(--fg-subtle)]">
              Start a new one or browse your older battles in Votes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function VoteRow({ vote, contextLabel }: { vote: HomeVoteSummary; contextLabel?: string }) {
  const viewer =
    contextLabel === "You started this"
      ? "owner"
      : contextLabel === "You're already in"
        ? "participant"
        : "browser";
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
  const displayDetailsLabel =
    contextLabel && contextLabel !== "You started this" && contextLabel !== "You're already in"
      ? `${contextLabel} · ${detailsLabel}`
      : detailsLabel;
  const mobileMetaLabel = buildMobileVoteMetaLine({
    itemCount: vote._count.items,
    participantCount: vote._count.participants,
    updatedAt: vote.updatedAt,
  });

  return (
    <div className={`${VOTE_CARD_SHELL_CLASS} relative`}>
      <Link
        href={`/sessions/${vote.id}`}
        aria-label={`Open vote ${vote.name}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      />
      <div className={VOTE_CARD_HEADER_CLASS}>
        <div className={VOTE_CARD_SUMMARY_LINK_CLASS}>
          <VotePreviewSummary
            title={vote.name}
            detailsLabel={displayDetailsLabel}
            secondaryLabel={secondaryLabel}
            mobileMetaLabel={mobileMetaLabel}
            items={vote.items}
            chips={chips}
            sourceLabel={sourceLabel}
          />
        </div>
        <div className={`${VOTE_CARD_TOP_ACTIONS_CLASS} relative z-20`}>
          {viewer === "owner" && (
            <ShareVoteButton
              joinCode={vote.joinCode}
              creatorId={null}
              status={vote.status}
              isLocked={vote.isLocked}
              canShareOverride
              iconOnly
            />
          )}
          <StatusBadge status={vote.status} />
        </div>
      </div>
    </div>
  );
}
