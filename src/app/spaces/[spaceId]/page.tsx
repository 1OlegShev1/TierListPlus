import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OpenSpaceMembershipControls } from "@/components/spaces/OpenSpaceMembershipControls";
import { RemoveSpaceMemberButton } from "@/components/spaces/RemoveSpaceMemberButton";
import { SpaceInvitePanel } from "@/components/spaces/SpaceInvitePanel";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VotePreviewSummary } from "@/components/ui/VotePreviewSummary";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadSpace, getSpaceAccessForUser } from "@/lib/space";
import { buildVoteDisplay } from "@/lib/vote-display";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type Tab = "votes" | "lists" | "members";

export default async function SpaceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ spaceId: string }>;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const { spaceId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawTab = typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : "votes";
  const tab: Tab = rawTab === "lists" || rawTab === "members" ? rawTab : "votes";

  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;

  const space = await getSpaceAccessForUser(spaceId, userId);
  if (!space) notFound();
  if (!canReadSpace(space.visibility, space.isMember)) notFound();

  const [lists, votes, members] = await Promise.all([
    tab === "lists"
      ? prisma.template.findMany({
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
        })
      : Promise.resolve([]),
    tab === "votes"
      ? prisma.session.findMany({
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
        })
      : Promise.resolve([]),
    tab === "members"
      ? prisma.spaceMember.findMany({
          where: { spaceId },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          select: {
            userId: true,
            role: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const canCreateInSpace = !!userId && space.isMember;

  return (
    <div className="space-y-6">
      <PageHeader
        title={space.name}
        subtitle={`${space.visibility === "OPEN" ? "Open" : "Private"} space`}
        actions={
          <OpenSpaceMembershipControls
            spaceId={space.id}
            isMember={space.isMember}
            isOwner={space.isOwner}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <TabLink spaceId={spaceId} tab="votes" active={tab === "votes"} label="Votes" />
        <TabLink spaceId={spaceId} tab="lists" active={tab === "lists"} label="Lists" />
        <TabLink spaceId={spaceId} tab="members" active={tab === "members"} label="Members" />
      </div>

      {tab === "votes" && (
        <section>
          <SectionHeader
            title="Space Votes"
            subtitle="Shared voting sessions in this space."
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
      )}

      {tab === "lists" && (
        <section>
          <SectionHeader
            title="Space Lists"
            subtitle="Shared list templates available in this space."
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
      )}

      {tab === "members" && (
        <section className="space-y-4">
          <SectionHeader
            title="Members"
            subtitle="People with membership access and creation rights in this space."
          />

          {space.visibility === "PRIVATE" && space.isOwner && (
            <SpaceInvitePanel spaceId={space.id} />
          )}

          <div className="rounded-xl border border-neutral-800 bg-neutral-900">
            {members.length === 0 ? (
              <div className="px-4 py-5 text-sm text-neutral-500">No members found.</div>
            ) : (
              <div className="divide-y divide-neutral-800">
                {members.map((member) => {
                  const canRemove =
                    space.isOwner && member.userId !== space.creatorId && member.userId !== userId;

                  return (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <p className="font-mono text-sm text-neutral-200">{member.userId}</p>
                        <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">
                          {member.role}
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
        </section>
      )}
    </div>
  );
}

function TabLink({
  spaceId,
  tab,
  active,
  label,
}: {
  spaceId: string;
  tab: Tab;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={`/spaces/${spaceId}?tab=${tab}`}
      className={`inline-flex h-9 items-center rounded-full border px-3 text-sm transition-colors ${
        active
          ? "border-amber-500 bg-amber-500/10 text-amber-300"
          : "border-neutral-700 text-neutral-300 hover:border-neutral-600"
      }`}
    >
      {label}
    </Link>
  );
}
