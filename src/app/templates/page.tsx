import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPreviewCard } from "@/components/ui/ListPreviewCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getCookieAuth } from "@/lib/auth";
import { buildListDisplay } from "@/lib/list-display";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const OWN_LISTS_PAGE_SIZE = 24;
const SHARED_LISTS_PAGE_SIZE = 12;
const PREVIEW_ITEM_COUNT = 4;

type SearchParams = Record<string, string | string[] | undefined>;

interface ListCard {
  id: string;
  name: string;
  creatorId: string | null;
  isPublic: boolean;
  updatedAt: Date;
  items: { id: string; imageUrl: string; label: string }[];
  _count: { items: number };
}

interface ListSectionData {
  lists: ListCard[];
  hasMore: boolean;
  hasPrevious: boolean;
  page: number;
}

export default async function ListsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;
  const ownPage = readPageParam(resolvedSearchParams.mine);
  const sharedPage = readPageParam(resolvedSearchParams.browse);

  const [ownListsSection, sharedListsSection] = await Promise.all([
    userId
      ? loadListSection({
          page: ownPage,
          pageSize: OWN_LISTS_PAGE_SIZE,
          where: {
            creatorId: userId,
            isHidden: false,
            spaceId: null,
          },
        })
      : Promise.resolve(emptySection(ownPage)),
    loadListSection({
      page: sharedPage,
      pageSize: SHARED_LISTS_PAGE_SIZE,
      where: userId
        ? {
            isPublic: true,
            isHidden: false,
            isModeratedHidden: false,
            spaceId: null,
            NOT: { creatorId: userId },
          }
        : {
            isPublic: true,
            isHidden: false,
            isModeratedHidden: false,
            spaceId: null,
          },
    }),
  ]);
  const showOwnSection =
    !!userId && (ownListsSection.lists.length > 0 || ownListsSection.hasPrevious);
  const showSharedSection = sharedListsSection.lists.length > 0 || sharedListsSection.hasPrevious;
  const isEmpty = !showOwnSection && !showSharedSection;

  return (
    <div>
      <PageHeader
        title="Lists"
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0">
            <Link href="/templates/new" className={buttonVariants.primary}>
              + Make a Tier List
            </Link>
          </div>
        }
      />

      {isEmpty ? (
        <EmptyState
          title="No lists yet"
          description="Make your first tier list and start some arguments"
        />
      ) : (
        <div className="space-y-10">
          {showOwnSection && (
            <ListSection
              title="Your Lists"
              subtitle="Lists you can edit, keep private, or use to start new votes."
              lists={ownListsSection.lists}
              viewer="owner"
              pagination={buildPagination({
                searchParams: resolvedSearchParams,
                key: "mine",
                page: ownListsSection.page,
                hasMore: ownListsSection.hasMore,
                hasPrevious: ownListsSection.hasPrevious,
              })}
            />
          )}

          {showSharedSection && (
            <ListSection
              title={userId ? "Shared Lists" : "Public Lists"}
              subtitle={
                userId
                  ? "Public lists from other people you can use as a starting point."
                  : "Public lists you can browse and use as a starting point."
              }
              lists={sharedListsSection.lists}
              viewer="browser"
              pagination={buildPagination({
                searchParams: resolvedSearchParams,
                key: "browse",
                page: sharedListsSection.page,
                hasMore: sharedListsSection.hasMore,
                hasPrevious: sharedListsSection.hasPrevious,
              })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ListSection({
  title,
  subtitle,
  lists,
  viewer,
  pagination,
}: {
  title: string;
  subtitle: string;
  lists: ListCard[];
  viewer: "owner" | "browser";
  pagination: {
    previousHref: string | null;
    nextHref: string | null;
    pageLabel: string;
  };
}) {
  return (
    <section>
      <SectionHeader title={title} subtitle={subtitle} />
      {lists.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => {
            const { chips, detailsLabel, secondaryLabel } = buildListDisplay({
              viewer,
              isPublic: list.isPublic,
              updatedAt: list.updatedAt,
              itemCount: list._count.items,
            });

            return (
              <Link key={list.id} href={`/templates/${list.id}`} className="block h-full">
                <ListPreviewCard
                  title={list.name}
                  detailsLabel={detailsLabel}
                  secondaryLabel={secondaryLabel}
                  items={list.items}
                  chips={chips}
                  className="transition-colors hover:border-[var(--border-strong)]"
                />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-soft-contrast)] px-5 py-4 text-sm text-[var(--fg-muted)]">
          Nothing else here right now.
        </div>
      )}
      {(pagination.previousHref || pagination.nextHref) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {pagination.previousHref && (
            <Link
              href={pagination.previousHref}
              className={`${buttonVariants.secondary} !rounded-xl !px-3 !py-1.5 !text-sm !font-medium sm:!px-3 sm:!py-1.5 sm:!text-sm`}
            >
              Newer
            </Link>
          )}
          {pagination.nextHref && (
            <Link
              href={pagination.nextHref}
              className={`${buttonVariants.secondary} !rounded-xl !px-3 !py-1.5 !text-sm !font-medium sm:!px-3 sm:!py-1.5 sm:!text-sm`}
            >
              More
            </Link>
          )}
          <p className="text-sm text-[var(--fg-muted)]">{pagination.pageLabel}</p>
        </div>
      )}
    </section>
  );
}

async function loadListSection({
  where,
  page,
  pageSize,
}: {
  where: Prisma.TemplateWhereInput;
  page: number;
  pageSize: number;
}): Promise<ListSectionData> {
  const lists = await prisma.template.findMany({
    where,
    include: {
      _count: { select: { items: true } },
      items: {
        take: PREVIEW_ITEM_COUNT,
        orderBy: { sortOrder: "asc" },
        select: { id: true, imageUrl: true, label: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
  });

  return {
    lists: lists.slice(0, pageSize),
    hasMore: lists.length > pageSize,
    hasPrevious: page > 1,
    page,
  };
}

function emptySection(page: number): ListSectionData {
  return {
    lists: [],
    hasMore: false,
    hasPrevious: page > 1,
    page,
  };
}

function readPageParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function buildPagination({
  searchParams,
  key,
  page,
  hasMore,
  hasPrevious,
}: {
  searchParams: SearchParams;
  key: "mine" | "browse";
  page: number;
  hasMore: boolean;
  hasPrevious: boolean;
}) {
  return {
    previousHref: hasPrevious ? buildPageHref(searchParams, key, page - 1) : null,
    nextHref: hasMore ? buildPageHref(searchParams, key, page + 1) : null,
    pageLabel: `Page ${page}`,
  };
}

function buildPageHref(searchParams: SearchParams, key: "mine" | "browse", page: number) {
  const params = new URLSearchParams();

  for (const [entryKey, entryValue] of Object.entries(searchParams)) {
    if (entryKey === key || entryValue == null) continue;
    if (Array.isArray(entryValue)) {
      for (const value of entryValue) {
        params.append(entryKey, value);
      }
      continue;
    }
    params.set(entryKey, entryValue);
  }

  if (page > 1) {
    params.set(key, String(page));
  }

  const query = params.toString();
  return query ? `/templates?${query}` : "/templates";
}
