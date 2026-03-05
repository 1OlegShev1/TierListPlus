import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OpenSpaceMembershipControls } from "@/components/spaces/OpenSpaceMembershipControls";
import { RemoveSpaceMemberButton } from "@/components/spaces/RemoveSpaceMemberButton";
import { SpaceInvitePanel } from "@/components/spaces/SpaceInvitePanel";
import { SpaceSettingsPanel } from "@/components/spaces/SpaceSettingsPanel";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { GearIcon } from "@/components/ui/GearIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VotePreviewSummary } from "@/components/ui/VotePreviewSummary";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadSpace, getSpaceAccessForUser } from "@/lib/space";
import { getSpaceAccentClasses } from "@/lib/space-theme";
import { buildVoteDisplay } from "@/lib/vote-display";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type Panel = "settings";

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
      take: 12,
    }),
    prisma.session.findMany({
      where: { spaceId },
      include: {
        template: { select: { name: true, isHidden: true } },
        items: {
          take: 4,
          orderBy: { sortOrder: "asc" },
          select: { id: true, imageUrl: true, label: true },
        },
        _count: { select: { participants: true, items: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 12,
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

  const canCreateInSpace = !!userId && space.isMember;
  const accent = getSpaceAccentClasses(space.accentColor);
  const nameInitial = space.name.trim().charAt(0).toUpperCase() || "?";

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

        <section>
          <SectionHeader
            title="Votes"
            subtitle="Active and recent voting sessions in this space."
            actionHref={canCreateInSpace ? `/sessions/new?spaceId=${spaceId}` : undefined}
            actionLabel={canCreateInSpace ? "Start vote" : undefined}
          />
          {votes.length === 0 ? (
            <EmptyState title="No votes yet" description="Start the first vote for this space." />
          ) : (
            <div className="space-y-4">
              {votes.map((vote) => {
                const { chips, detailsLabel, secondaryLabel, sourceLabel } = buildVoteDisplay({
                  viewer: "browser",
                  isPrivate: vote.isPrivate,
                  isLocked: vote.isLocked,
                  status: vote.status,
                  updatedAt: vote.updatedAt,
                  itemCount: vote._count.items,
                  participantCount: vote._count.participants,
                  listName: vote.template.name,
                  listHidden: vote.template.isHidden,
                  spaceVisibility: space.visibility,
                });

                return (
                  <div
                    key={vote.id}
                    className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4 sm:flex-row sm:items-center sm:gap-5"
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
                      <Link href={`/sessions/${vote.id}`} className={buttonVariants.secondary}>
                        {vote.status === "OPEN" ? "Open" : "Results"}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <SectionHeader
            title="Lists"
            subtitle="Templates this space collaborates on and votes from."
            actionHref={canCreateInSpace ? `/templates/new?spaceId=${spaceId}` : undefined}
            actionLabel={canCreateInSpace ? "Make list" : undefined}
          />
          {lists.length === 0 ? (
            <EmptyState title="No lists yet" description="Create the first list for this space." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lists.map((list) => (
                <Link
                  key={list.id}
                  href={`/templates/${list.id}`}
                  className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600"
                >
                  <p className="truncate text-base font-semibold text-neutral-100">{list.name}</p>
                  <p className="mt-1 text-sm text-neutral-500">{list._count.items} picks</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {space.isOwner ? (
          <details className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
            <summary className="cursor-pointer text-sm font-medium text-neutral-300 hover:text-neutral-100">
              Owner access controls
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
                      const displayName = member.user.nickname?.trim() || `Member ${index + 1}`;
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
