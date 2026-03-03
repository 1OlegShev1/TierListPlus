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
import { getTemplateVisibilityWhere } from "@/lib/template-access";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;
  const lists = await prisma.template.findMany({
    where: getTemplateVisibilityWhere(userId),
    include: {
      _count: { select: { items: true } },
      items: { take: 4, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const ownLists = userId ? lists.filter((list) => list.creatorId === userId) : [];
  const sharedLists = userId ? lists.filter((list) => list.creatorId !== userId) : lists;

  return (
    <div>
      <PageHeader
        title="Lists"
        actions={
          <Link href="/templates/new" className={buttonVariants.primary}>
            + Make a Tier List
          </Link>
        }
      />

      {lists.length === 0 ? (
        <EmptyState
          title="No lists yet"
          description="Make your first tier list and start some arguments"
        />
      ) : (
        <div className="space-y-10">
          {ownLists.length > 0 && (
            <ListSection
              title="Your Lists"
              subtitle="Lists you can edit, keep private, or use to start new votes."
              lists={ownLists}
              viewer="owner"
            />
          )}

          {sharedLists.length > 0 && (
            <ListSection
              title={userId ? "Shared Lists" : "Public Lists"}
              subtitle={
                userId
                  ? "Public lists from other people you can use as a starting point."
                  : "Public lists you can browse and use as a starting point."
              }
              lists={sharedLists}
              viewer="browser"
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
}: {
  title: string;
  subtitle: string;
  lists: {
    id: string;
    name: string;
    isPublic: boolean;
    updatedAt: Date;
    items: { id: string; imageUrl: string; label: string }[];
    _count: { items: number };
  }[];
  viewer: "owner" | "browser";
}) {
  return (
    <section>
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => {
          const { chips, meta } = buildListDisplay({
            viewer,
            isPublic: list.isPublic,
            updatedAt: list.updatedAt,
            itemCount: list._count.items,
          });

          return (
            <Link key={list.id} href={`/templates/${list.id}`} className="block">
              <ListPreviewCard
                title={list.name}
                meta={meta}
                items={list.items}
                chips={chips}
                className="transition-colors hover:border-neutral-600"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
