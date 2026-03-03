import { cookies } from "next/headers";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ItemPreview } from "@/components/ui/ItemPreview";
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
            <Link
              key={list.id}
              href={`/templates/${list.id}`}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/95 p-5 transition-colors hover:border-neutral-600"
            >
              <ItemPreview items={list.items} className="mb-4" />
              <h3 className="text-lg font-semibold text-neutral-100">{list.name}</h3>
              <p className="mt-2 text-sm text-neutral-500">
                {list._count.items} picks &middot; {formatDate(list.createdAt)}
              </p>
              {!list.isPublic && (
                <p className="mt-2 text-sm font-medium text-amber-400">Private to you</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
