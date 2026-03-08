import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareVoteButton } from "@/components/sessions/ShareVoteButton";
import { OpenSpaceMembershipControls } from "@/components/spaces/OpenSpaceMembershipControls";
import { RemoveSpaceMemberButton } from "@/components/spaces/RemoveSpaceMemberButton";
import { SpaceInvitePanel } from "@/components/spaces/SpaceInvitePanel";
import { SpaceSettingsPanel } from "@/components/spaces/SpaceSettingsPanel";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { GearIcon } from "@/components/ui/GearIcon";
import { ChevronDownIcon } from "@/components/ui/icons";
import { ListPreviewCard } from "@/components/ui/ListPreviewCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VotePreviewSummary } from "@/components/ui/VotePreviewSummary";
import { getCookieAuth } from "@/lib/auth";
import { buildListDisplay } from "@/lib/list-display";
import { prisma } from "@/lib/prisma";
import { canReadSpace, getSpaceAccessForUser } from "@/lib/space";
import { getSpaceAccentClasses } from "@/lib/space-theme";
import { buildVoteDisplay } from "@/lib/vote-display";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type Panel = "settings";
const SPACE_LANDING_SECTION_LIMIT = 4;
const SPACE_SECTION_PAGE_SIZE = 12;
const SPACE_MEMBER_NICKNAME_SAMPLE_PER_MEMBER = 20;
const SPACE_MEMBER_NICKNAME_SAMPLE_MAX = 800;

export default async function SpaceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string }>;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const { spaceId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawPanel =
    typeof resolvedSearchParams.panel === "string" ? resolvedSearchParams.panel : null;
  const panel: Panel | null = rawPanel === "settings" ? rawPanel : null;
  const votesExpanded = resolvedSearchParams.votesView === "all";
  const listsExpanded = resolvedSearchParams.listsView === "all";
  const votesPage = readPageParam(votesExpanded ? resolvedSearchParams.votesPage : undefined);
  const listsPage = readPageParam(listsExpanded ? resolvedSearchParams.listsPage : undefined);
  const votesPageSize = votesExpanded ? SPACE_SECTION_PAGE_SIZE : SPACE_LANDING_SECTION_LIMIT;
  const listsPageSize = listsExpanded ? SPACE_SECTION_PAGE_SIZE : SPACE_LANDING_SECTION_LIMIT;

  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;

  const space = await getSpaceAccessForUser(spaceId, userId);
  if (!space) notFound();
  if (!canReadSpace(space.visibility, space.isMember)) notFound();

  const [lists, votes, members, counts] = await Promise.all([
    prisma.template.findMany({
      where: { spaceId, isHidden: false },
      include: {
        _count: { select: { items: true } },
        items: {
          take: 4,
          orderBy: { sortOrder: "asc" },
          select: { id: true, imageUrl: true, label: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: listsExpanded ? (listsPage - 1) * listsPageSize : 0,
      take: listsPageSize + 1,
    }),
    prisma.session.findMany({
      where: { spaceId },
      include: {
        template: { select: { name: true, isHidden: true } },
        participants: userId
          ? {
              where: { userId },
              select: { id: true },
              take: 1,
            }
          : false,
        items: {
          take: 4,
          orderBy: { sortOrder: "asc" },
          select: { id: true, imageUrl: true, label: true },
        },
        _count: { select: { participants: true, items: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: votesExpanded ? (votesPage - 1) * votesPageSize : 0,
      take: votesPageSize + 1,
    }),
    space.isOwner
      ? prisma.spaceMember.findMany({
          where: { spaceId },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          select: {
            userId: true,
            role: true,
            createdAt: true,
            user: {
              select: {
                nickname: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.space.findUnique({
      where: { id: spaceId },
      select: {
        _count: { select: { members: true, templates: true, sessions: true } },
      },
    }),
  ]);
  const memberNicknameSampleSize = Math.min(
    SPACE_MEMBER_NICKNAME_SAMPLE_MAX,
    Math.max(
      SPACE_MEMBER_NICKNAME_SAMPLE_PER_MEMBER,
      members.length * SPACE_MEMBER_NICKNAME_SAMPLE_PER_MEMBER,
    ),
  );
  const memberNicknameSamples =
    space.isOwner && members.length > 0
      ? await prisma.participant.findMany({
          where: {
            userId: { in: members.map((member) => member.userId) },
            session: { spaceId },
          },
          select: {
            userId: true,
            nickname: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: memberNicknameSampleSize,
        })
      : [];
  const memberNicknameProfiles = buildMemberNicknameProfiles(memberNicknameSamples);

  const canCreateInSpace = !!userId && space.isMember;
  const accent = getSpaceAccentClasses(space.accentColor);
  const nameInitial = space.name.trim().charAt(0).toUpperCase() || "?";
  const votesHasMore = votes.length > votesPageSize;
  const listsHasMore = lists.length > listsPageSize;
  const visibleVotes = votes.slice(0, votesPageSize);
  const visibleLists = lists.slice(0, listsPageSize);
  const totalVotes = counts?._count.sessions ?? 0;
  const totalLists = counts?._count.templates ?? 0;
  const showVotesSeeAll = !votesExpanded && totalVotes > SPACE_LANDING_SECTION_LIMIT;
  const showListsSeeAll = !listsExpanded && totalLists > SPACE_LANDING_SECTION_LIMIT;
  const sectionActionBaseClassName =
    "inline-flex h-9 min-w-[7rem] shrink-0 self-start items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors";
  const sectionSecondaryActionClassName = `${sectionActionBaseClassName} border-neutral-700 bg-black text-neutral-100 hover:border-neutral-500 hover:bg-neutral-900`;
  const sectionPrimaryActionClassName = `${sectionActionBaseClassName} border-amber-400 bg-amber-500 text-neutral-950 hover:border-amber-300 hover:bg-amber-400`;

  return (
    <>
      <div className="space-y-8">
        <Link href="/spaces" className={`${buttonVariants.ghost} inline-flex items-center`}>
          &larr; Back to Spaces
        </Link>

        <PageHeader
          title={
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-950">
                {space.logoUrl ? (
                  <img
                    src={space.logoUrl}
                    alt={`${space.name} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-base font-semibold text-neutral-400">{nameInitial}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-2xl font-bold text-neutral-100">{space.name}</p>
                  {space.isOwner ? (
                    <Link
                      href={spaceHref(spaceId, "settings")}
                      className="inline-flex h-10 w-10 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-200"
                      aria-label="Open space settings"
                    >
                      <GearIcon className="h-6 w-6" />
                    </Link>
                  ) : null}
                </div>
                <p
                  className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[0.67rem] uppercase tracking-[0.11em] ${accent.badgeClassName}`}
                >
                  {space.visibility === "OPEN" ? "Open" : "Private"} space
                </p>
              </div>
            </div>
          }
          subtitle={
            <div className="space-y-1">
              {space.description ? <p className="text-neutral-400">{space.description}</p> : null}
              <p className="text-xs text-neutral-500">
                {counts?._count.members ?? 0} members · {counts?._count.templates ?? 0} lists ·{" "}
                {counts?._count.sessions ?? 0} votes
              </p>
            </div>
          }
          actions={
            <OpenSpaceMembershipControls
              spaceId={space.id}
              isMember={space.isMember}
              isOwner={space.isOwner}
            />
          }
        />

        <section id="votes">
          <SectionHeader
            title="Votes"
            subtitle="Active and recent voting sessions in this space."
            actions={
              <div className="flex items-center gap-2">
                {canCreateInSpace ? (
                  <Link
                    href={`/sessions/new?spaceId=${spaceId}`}
                    className={sectionPrimaryActionClassName}
                  >
                    Start vote
                  </Link>
                ) : null}
                {votesExpanded ? (
                  <Link
                    href={buildSpaceHref(spaceId, resolvedSearchParams, {
                      votesView: null,
                      votesPage: null,
                    })}
                    className={sectionSecondaryActionClassName}
                  >
                    Overview
                  </Link>
                ) : showVotesSeeAll ? (
                  <Link
                    href={buildSpaceHref(
                      spaceId,
                      resolvedSearchParams,
                      { votesView: "all", votesPage: null },
                      "votes",
                    )}
                    className={sectionSecondaryActionClassName}
                  >
                    See all
                  </Link>
                ) : null}
              </div>
            }
          />
          {visibleVotes.length === 0 ? (
            <EmptyState title="No votes yet" description="Start the first vote for this space." />
          ) : (
            <div className="space-y-4">
              {visibleVotes.map((vote) => {
                const viewer =
                  userId && vote.creatorId === userId
                    ? "owner"
                    : userId && vote.participants.length > 0
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
                  spaceVisibility: space.visibility,
                  accessLabel: "Space",
                });

                return (
                  <div
                    key={vote.id}
                    className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600 sm:flex-row sm:items-center sm:gap-5"
                  >
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
                    <div className="flex items-center gap-2 sm:shrink-0">
                      {vote.status !== "OPEN" && <StatusBadge status={vote.status} />}
                      <ShareVoteButton
                        joinCode={vote.joinCode}
                        creatorId={vote.creatorId}
                        status={vote.status}
                        isLocked={vote.isLocked}
                        iconOnly
                      />
                      <Link href={`/sessions/${vote.id}`} className={buttonVariants.secondary}>
                        {vote.status === "OPEN" ? "Open" : "Results"}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {votesExpanded && (votesHasMore || votesPage > 1) ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {votesPage > 1 ? (
                <Link
                  href={buildSpaceHref(spaceId, resolvedSearchParams, {
                    votesView: "all",
                    votesPage: votesPage - 1 > 1 ? String(votesPage - 1) : null,
                  })}
                  className={`${buttonVariants.secondary} !rounded-xl !px-3 !py-1.5 !text-sm !font-medium`}
                >
                  Newer
                </Link>
              ) : null}
              {votesHasMore ? (
                <Link
                  href={buildSpaceHref(spaceId, resolvedSearchParams, {
                    votesView: "all",
                    votesPage: String(votesPage + 1),
                  })}
                  className={`${buttonVariants.secondary} !rounded-xl !px-3 !py-1.5 !text-sm !font-medium`}
                >
                  More
                </Link>
              ) : null}
              <p className="text-sm text-neutral-500">{`Page ${votesPage}`}</p>
            </div>
          ) : null}
        </section>

        <section id="lists">
          <SectionHeader
            title="Lists"
            subtitle="Templates this space collaborates on and votes from."
            actions={
              <div className="flex items-center gap-2">
                {canCreateInSpace ? (
                  <Link
                    href={`/templates/new?spaceId=${spaceId}`}
                    className={sectionPrimaryActionClassName}
                  >
                    Make list
                  </Link>
                ) : null}
                {listsExpanded ? (
                  <Link
                    href={buildSpaceHref(spaceId, resolvedSearchParams, {
                      listsView: null,
                      listsPage: null,
                    })}
                    className={sectionSecondaryActionClassName}
                  >
                    Overview
                  </Link>
                ) : showListsSeeAll ? (
                  <Link
                    href={buildSpaceHref(
                      spaceId,
                      resolvedSearchParams,
                      { listsView: "all", listsPage: null },
                      "lists",
                    )}
                    className={sectionSecondaryActionClassName}
                  >
                    See all
                  </Link>
                ) : null}
              </div>
            }
          />
          {visibleLists.length === 0 ? (
            <EmptyState title="No lists yet" description="Create the first list for this space." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleLists.map((list) => {
                const { chips, detailsLabel, secondaryLabel } = buildListDisplay({
                  viewer: userId && list.creatorId === userId ? "owner" : "browser",
                  isPublic: list.isPublic,
                  updatedAt: list.updatedAt,
                  itemCount: list._count.items,
                  accessLabel: "Space",
                });

                return (
                  <Link key={list.id} href={`/templates/${list.id}`} className="block h-full">
                    <ListPreviewCard
                      title={list.name}
                      detailsLabel={detailsLabel}
                      secondaryLabel={secondaryLabel}
                      items={list.items}
                      chips={chips}
                      className="transition-colors hover:border-neutral-600"
                    />
                  </Link>
                );
              })}
            </div>
          )}
          {listsExpanded && (listsHasMore || listsPage > 1) ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {listsPage > 1 ? (
                <Link
                  href={buildSpaceHref(spaceId, resolvedSearchParams, {
                    listsView: "all",
                    listsPage: listsPage - 1 > 1 ? String(listsPage - 1) : null,
                  })}
                  className={`${buttonVariants.secondary} !rounded-xl !px-3 !py-1.5 !text-sm !font-medium`}
                >
                  Newer
                </Link>
              ) : null}
              {listsHasMore ? (
                <Link
                  href={buildSpaceHref(spaceId, resolvedSearchParams, {
                    listsView: "all",
                    listsPage: String(listsPage + 1),
                  })}
                  className={`${buttonVariants.secondary} !rounded-xl !px-3 !py-1.5 !text-sm !font-medium`}
                >
                  More
                </Link>
              ) : null}
              <p className="text-sm text-neutral-500">{`Page ${listsPage}`}</p>
            </div>
          ) : null}
        </section>

        {space.isOwner ? (
          <details className="group rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 transition-colors hover:border-neutral-700 hover:bg-neutral-900/40">
            <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 rounded-lg p-2 text-left text-sm font-medium text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 [&::-webkit-details-marker]:hidden">
              <span>Owner access controls</span>
              <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center">
                <ChevronDownIcon className="h-7 w-7 text-neutral-500 transition-all group-hover:text-neutral-200 group-open:rotate-180" />
              </span>
            </summary>
            <div className="mt-4 space-y-4">
              {space.visibility === "PRIVATE" ? <SpaceInvitePanel spaceId={space.id} /> : null}
              <div className="rounded-xl border border-neutral-800 bg-neutral-900">
                {members.length === 0 ? (
                  <div className="px-4 py-5 text-sm text-neutral-500">No members found.</div>
                ) : (
                  <div className="divide-y divide-neutral-800">
                    {members.map((member, index) => {
                      const canRemove =
                        member.userId !== space.creatorId && member.userId !== userId;
                      const nicknameProfile = memberNicknameProfiles.get(member.userId);
                      const displayName =
                        member.user.nickname?.trim() ||
                        nicknameProfile?.primaryNickname ||
                        `Member ${index + 1}`;
                      const aliasNicknames = (nicknameProfile?.nicknames ?? []).filter(
                        (nickname) =>
                          nickname.localeCompare(displayName, undefined, {
                            sensitivity: "accent",
                          }) !== 0,
                      );
                      const joinedOn = new Date(member.createdAt).toLocaleDateString();

                      return (
                        <div
                          key={member.userId}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-neutral-200">
                              {displayName}
                            </p>
                            <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                              {member.role} · joined {joinedOn}
                            </p>
                            {aliasNicknames.length > 0 ? (
                              <p className="mt-0.5 truncate text-xs text-neutral-500">
                                Also used: {aliasNicknames.slice(0, 3).join(", ")}
                              </p>
                            ) : null}
                          </div>
                          {canRemove ? (
                            <RemoveSpaceMemberButton spaceId={space.id} userId={member.userId} />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </details>
        ) : null}
      </div>

      {space.isOwner && panel === "settings" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6">
          <Link
            href={spaceHref(spaceId)}
            aria-label="Close settings"
            className="absolute inset-0 z-0"
          />
          <div className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl shadow-black/60 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-neutral-100">Space settings</h2>
            </div>
            <SpaceSettingsPanel
              spaceId={space.id}
              initialName={space.name}
              initialDescription={space.description}
              initialLogoUrl={space.logoUrl}
              initialAccentColor={space.accentColor}
              initialVisibility={space.visibility}
              showHeader={false}
              defaultMode="edit"
              closeHref={spaceHref(space.id)}
              className="border-neutral-700 bg-neutral-950"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function spaceHref(spaceId: string, panel: Panel | null = null) {
  const params = new URLSearchParams();
  if (panel === "settings") params.set("panel", panel);
  const query = params.toString();
  return query ? `/spaces/${spaceId}?${query}` : `/spaces/${spaceId}`;
}

function readPageParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function buildSpaceHref(
  spaceId: string,
  searchParams: SearchParams,
  updates: Record<string, string | null>,
  hash?: string,
) {
  const params = new URLSearchParams();

  for (const [entryKey, entryValue] of Object.entries(searchParams)) {
    if (updates[entryKey] !== undefined || entryValue == null) continue;
    if (Array.isArray(entryValue)) {
      for (const value of entryValue) {
        params.append(entryKey, value);
      }
      continue;
    }
    params.set(entryKey, entryValue);
  }

  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === "") {
      params.delete(key);
      continue;
    }
    params.set(key, value);
  }

  const query = params.toString();
  const base = query ? `/spaces/${spaceId}?${query}` : `/spaces/${spaceId}`;
  return hash ? `${base}#${hash}` : base;
}

function buildMemberNicknameProfiles(
  rows: Array<{ userId: string | null; nickname: string; createdAt: Date }>,
) {
  type NicknameStats = { count: number; latestAt: number };
  const byUser = new Map<string, Map<string, NicknameStats>>();

  for (const row of rows) {
    if (!row.userId) continue;
    const trimmedNickname = row.nickname.trim();
    if (!trimmedNickname) continue;

    const byNickname = byUser.get(row.userId) ?? new Map<string, NicknameStats>();
    const existing = byNickname.get(trimmedNickname);
    const createdAt = row.createdAt.getTime();
    if (existing) {
      existing.count += 1;
      if (createdAt > existing.latestAt) existing.latestAt = createdAt;
    } else {
      byNickname.set(trimmedNickname, { count: 1, latestAt: createdAt });
    }
    byUser.set(row.userId, byNickname);
  }

  const profiles = new Map<string, { primaryNickname: string; nicknames: string[] }>();
  for (const [userId, nicknameStats] of byUser.entries()) {
    const sortedNicknames = [...nicknameStats.entries()].sort((left, right) => {
      if (right[1].count !== left[1].count) return right[1].count - left[1].count;
      if (right[1].latestAt !== left[1].latestAt) return right[1].latestAt - left[1].latestAt;
      return left[0].localeCompare(right[0]);
    });
    if (sortedNicknames.length === 0) continue;
    profiles.set(userId, {
      primaryNickname: sortedNicknames[0][0],
      nicknames: sortedNicknames.map(([nickname]) => nickname),
    });
  }

  return profiles;
}
