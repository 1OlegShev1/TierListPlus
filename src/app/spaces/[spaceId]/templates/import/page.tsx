import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CopyListToSpaceButton } from "@/components/spaces/CopyListToSpaceButton";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPreviewCard } from "@/components/ui/ListPreviewCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCookieAuth } from "@/lib/auth";
import { buildListDisplay } from "@/lib/list-display";
import { prisma } from "@/lib/prisma";
import { canReadSpace, getSpaceAccessForUser } from "@/lib/space";

const IMPORT_PREVIEW_ITEM_COUNT = 4;
const IMPORT_LIST_LIMIT = 36;

export const dynamic = "force-dynamic";

export default async function SpaceImportTemplatePage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;

  const space = await getSpaceAccessForUser(spaceId, userId);
  if (!space) notFound();
  if (!canReadSpace(space.visibility, space.isMember)) notFound();
  if (!space.isMember) {
    redirect(`/spaces/${space.id}`);
  }

  const sourceLists = await prisma.template.findMany({
    where: {
      spaceId: null,
      isHidden: false,
      OR: [{ isPublic: true }, { creatorId: userId }],
    },
    include: {
      _count: { select: { items: true } },
      items: {
        take: IMPORT_PREVIEW_ITEM_COUNT,
        orderBy: { sortOrder: "asc" },
        select: { id: true, imageUrl: true, label: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: IMPORT_LIST_LIMIT,
  });

  return (
    <div className="space-y-6">
      <Link
        href={`/spaces/${space.id}#lists`}
        className={`${buttonVariants.ghost} inline-flex items-center`}
      >
        &larr; Back to Space
      </Link>

      <PageHeader
        title="Copy a List into This Space"
        subtitle="Pick a public list or one of your own lists. We will create a space copy you can edit and reuse."
      />

      {sourceLists.length === 0 ? (
        <EmptyState
          title="No lists available to copy"
          description="Create your own list first, or wait for public lists to appear."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sourceLists.map((list) => {
            const { chips, detailsLabel, secondaryLabel } = buildListDisplay({
              viewer: userId && list.creatorId === userId ? "owner" : "browser",
              isPublic: list.isPublic,
              updatedAt: list.updatedAt,
              itemCount: list._count.items,
            });

            return (
              <div
                key={list.id}
                className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-950/30 p-3 sm:flex-row sm:items-center"
              >
                <Link href={`/templates/${list.id}`} className="min-w-0 flex-1">
                  <ListPreviewCard
                    title={list.name}
                    detailsLabel={detailsLabel}
                    secondaryLabel={secondaryLabel}
                    items={list.items}
                    chips={chips}
                    className="transition-colors hover:border-neutral-600"
                  />
                </Link>
                <div className="sm:shrink-0">
                  <CopyListToSpaceButton spaceId={space.id} sourceTemplateId={list.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
