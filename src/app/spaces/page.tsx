import type { SpaceAccentColor } from "@prisma/client";
import { cookies } from "next/headers";
import Link from "next/link";
import { SpaceActionPanel } from "@/components/spaces/SpaceActionPanel";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSpaceAccentClasses } from "@/lib/space-theme";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const SPACES_ADMIN_PAGE_SIZE = 24;

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
  const isAdmin = auth?.role === "ADMIN";
  const adminPage = isAdmin ? readPageParam(resolvedSearchParams.page) : 1;
  const adminSkip = isAdmin ? (adminPage - 1) * SPACES_ADMIN_PAGE_SIZE : 0;

  const [rawMySpaces, discoverOpenSpaces] = await Promise.all([
    userId
      ? prisma.space.findMany({
          where: isAdmin ? {} : { members: { some: { userId } } },
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
          ...(isAdmin ? { skip: adminSkip, take: SPACES_ADMIN_PAGE_SIZE + 1 } : {}),
        })
      : Promise.resolve([]),
    isAdmin
      ? Promise.resolve([])
      : prisma.space.findMany({
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
  const adminHasMore = isAdmin && rawMySpaces.length > SPACES_ADMIN_PAGE_SIZE;
  const mySpaces =
    isAdmin && adminHasMore ? rawMySpaces.slice(0, SPACES_ADMIN_PAGE_SIZE) : rawMySpaces;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Spaces"
        subtitle="Discover communities, track active spaces, and jump into shared rankings."
      />

      <section>
        <SectionHeader
          title={isAdmin ? "All Spaces" : "Your Spaces"}
          subtitle={isAdmin ? "Admin view across all spaces." : "Spaces you own or have joined."}
        />
        {mySpaces.length === 0 ? (
          <EmptyState
            title="No spaces yet"
            description="Use Create or Join below when you are ready."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" id="spaces-grid">
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
        {isAdmin && (adminHasMore || adminPage > 1) ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {adminPage > 1 ? (
              <Link
                href={buildSpacesHref(
                  resolvedSearchParams,
                  adminPage - 1 > 1 ? String(adminPage - 1) : null,
                  "spaces-grid",
                )}
                className={`${buttonVariants.secondary} !rounded-xl !px-3 !py-1.5 !text-sm !font-medium`}
              >
                Newer
              </Link>
            ) : null}
            {adminHasMore ? (
              <Link
                href={buildSpacesHref(resolvedSearchParams, String(adminPage + 1), "spaces-grid")}
                className={`${buttonVariants.secondary} !rounded-xl !px-3 !py-1.5 !text-sm !font-medium`}
              >
                More
              </Link>
            ) : null}
            <p className="text-sm text-[var(--fg-subtle)]">{`Page ${adminPage}`}</p>
          </div>
        ) : null}
      </section>

      {!isAdmin ? (
        <section>
          <SectionHeader
            title="Discover Open Spaces"
            subtitle="Open communities you can browse, join, and rank in."
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
      ) : null}

      <SpaceActionPanel
        defaultOpen={mySpaces.length === 0 || joinCode.length > 0 || expectedSpaceId.length > 0}
        defaultJoinCode={joinCode}
        defaultExpectedSpaceId={expectedSpaceId}
      />
    </div>
  );
}

function readPageParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function buildSpacesHref(searchParams: SearchParams, page: string | null, hash?: string) {
  const params = new URLSearchParams();

  for (const [entryKey, entryValue] of Object.entries(searchParams)) {
    if (entryKey === "page" || entryValue == null) continue;
    if (Array.isArray(entryValue)) {
      for (const value of entryValue) {
        params.append(entryKey, value);
      }
      continue;
    }
    params.set(entryKey, entryValue);
  }

  if (page) {
    params.set("page", page);
  }

  const query = params.toString();
  const base = query ? `/spaces?${query}` : "/spaces";
  return hash ? `${base}#${hash}` : base;
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
                className="h-full w-full object-contain p-1"
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
        {memberCount} members · {listCount} lists · {voteCount} rankings
      </p>
    </Link>
  );
}
