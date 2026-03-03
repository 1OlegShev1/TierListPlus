import { cookies } from "next/headers";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPreviewCard } from "@/components/ui/ListPreviewCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTemplateVisibilityWhere } from "@/lib/template-access";
import { formatDate } from "@/lib/utils";

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
    orderBy: { createdAt: "desc" },
  });

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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <Link key={list.id} href={`/templates/${list.id}`} className="block">
              <ListPreviewCard
                title={list.name}
                meta={`${list._count.items} picks · ${formatDate(list.createdAt)}`}
                items={list.items}
                note={!list.isPublic ? "Private to you" : undefined}
                className="transition-colors hover:border-neutral-600"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
