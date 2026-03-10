import type { SpaceAccentColor } from "@prisma/client";
import { cookies } from "next/headers";
import Link from "next/link";
import { SpaceActionPanel } from "@/components/spaces/SpaceActionPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSpaceAccentClasses } from "@/lib/space-theme";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SpacesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const joinCodeParam =
    typeof resolvedSearchParams.joinCode === "string" ? resolvedSearchParams.joinCode : "";
  const joinCode = joinCodeParam.trim().toUpperCase();
  const expectedSpaceIdParam =
    typeof resolvedSearchParams.expectedSpaceId === "string"
      ? resolvedSearchParams.expectedSpaceId
      : "";
  const expectedSpaceId = expectedSpaceIdParam.trim();
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;

  const [mySpaces, discoverOpenSpaces] = await Promise.all([
    userId
      ? prisma.space.findMany({
          where: { members: { some: { userId } } },
          include: {
            _count: {
              select: {
                members: true,
                templates: { where: { isHidden: false } },
                sessions: true,
              },
            },
          },
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
      include: {
        _count: {
          select: {
            members: true,
            templates: { where: { isHidden: false } },
            sessions: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Spaces"
        subtitle="Discover communities, track active spaces, and jump into shared votes."
      />

      <section>
        <SectionHeader title="Your Spaces" subtitle="Spaces you own or have joined." />
        {mySpaces.length === 0 ? (
          <EmptyState
            title="No spaces yet"
            description="Use Create or Join below when you are ready."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mySpaces.map((space) => (
              <SpaceCard
                key={space.id}
                id={space.id}
                name={space.name}
                description={space.description}
                logoUrl={space.logoUrl}
                accentColor={space.accentColor}
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
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-soft-contrast)] px-5 py-4 text-sm text-[var(--fg-subtle)]">
            No open spaces to discover right now.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {discoverOpenSpaces.map((space) => (
              <SpaceCard
                key={space.id}
                id={space.id}
                name={space.name}
                description={space.description}
                logoUrl={space.logoUrl}
                accentColor={space.accentColor}
                visibility={space.visibility}
                memberCount={space._count.members}
                listCount={space._count.templates}
                voteCount={space._count.sessions}
              />
            ))}
          </div>
        )}
      </section>

      <SpaceActionPanel
        defaultOpen={mySpaces.length === 0 || joinCode.length > 0 || expectedSpaceId.length > 0}
        defaultJoinCode={joinCode}
        defaultExpectedSpaceId={expectedSpaceId}
      />
    </div>
  );
}

function SpaceCard({
  id,
  name,
  description,
  logoUrl,
  accentColor,
  visibility,
  memberCount,
  listCount,
  voteCount,
}: {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  accentColor: SpaceAccentColor;
  visibility: "PRIVATE" | "OPEN";
  memberCount: number;
  listCount: number;
  voteCount: number;
}) {
  const visibilityLabel = visibility === "OPEN" ? "Open" : "Private";
  const accent = getSpaceAccentClasses(accentColor);
  const nameInitial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <Link
      href={`/spaces/${id}`}
      className={`card-hover-lift relative overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition-colors ${accent.borderClassName}`}
    >
      <div className={`pointer-events-none absolute inset-0 opacity-80 ${accent.glowClassName}`} />
      <div className="relative">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)]">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${name} logo`}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className="text-sm font-semibold text-[var(--fg-muted)]">{nameInitial}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-[var(--fg-primary)]">{name}</p>
            <p
              className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[0.67rem] uppercase tracking-[0.11em] ${accent.badgeClassName}`}
            >
              {visibilityLabel}
            </p>
          </div>
        </div>
      </div>
      {description ? (
        <p className="relative mt-3 text-sm text-[var(--fg-muted)]">{description}</p>
      ) : null}
      <p className="mt-3 text-sm text-[var(--fg-muted)]">
        {memberCount} members · {listCount} lists · {voteCount} votes
      </p>
    </Link>
  );
}
