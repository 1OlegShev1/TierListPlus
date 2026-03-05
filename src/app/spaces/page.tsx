import { cookies } from "next/headers";
import Link from "next/link";
import { CreateSpaceForm } from "@/components/spaces/CreateSpaceForm";
import { JoinSpaceByCodeForm } from "@/components/spaces/JoinSpaceByCodeForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SpacesPage() {
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;

  const [mySpaces, discoverOpenSpaces] = await Promise.all([
    userId
      ? prisma.space.findMany({
          where: { members: { some: { userId } } },
          include: { _count: { select: { members: true, templates: true, sessions: true } } },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.space.findMany({
      where: userId
        ? {
            visibility: "OPEN",
            NOT: { members: { some: { userId } } },
          }
        : {
            visibility: "OPEN",
          },
      include: { _count: { select: { members: true, templates: true, sessions: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Spaces"
        subtitle="Build private group hubs or open communities for shared ranking chaos."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CreateSpaceForm />
        <JoinSpaceByCodeForm />
      </div>

      <section>
        <SectionHeader title="Your Spaces" subtitle="Spaces you own or have joined." />
        {mySpaces.length === 0 ? (
          <EmptyState title="No spaces yet" description="Create one or join with an invite code." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mySpaces.map((space) => (
              <SpaceCard
                key={space.id}
                id={space.id}
                name={space.name}
                visibility={space.visibility}
                memberCount={space._count.members}
                listCount={space._count.templates}
                voteCount={space._count.sessions}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Discover Open Spaces"
          subtitle="Open communities you can browse, join, and vote in."
        />
        {discoverOpenSpaces.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/40 px-5 py-4 text-sm text-neutral-500">
            No open spaces to discover right now.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {discoverOpenSpaces.map((space) => (
              <SpaceCard
                key={space.id}
                id={space.id}
                name={space.name}
                visibility={space.visibility}
                memberCount={space._count.members}
                listCount={space._count.templates}
                voteCount={space._count.sessions}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SpaceCard({
  id,
  name,
  visibility,
  memberCount,
  listCount,
  voteCount,
}: {
  id: string;
  name: string;
  visibility: "PRIVATE" | "OPEN";
  memberCount: number;
  listCount: number;
  voteCount: number;
}) {
  return (
    <Link
      href={`/spaces/${id}`}
      className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600"
    >
      <p className="text-lg font-semibold text-neutral-100">{name}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-neutral-500">{visibility}</p>
      <p className="mt-3 text-sm text-neutral-400">
        {memberCount} members · {listCount} lists · {voteCount} votes
      </p>
    </Link>
  );
}
