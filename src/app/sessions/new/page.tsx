import { cookies } from "next/headers";
import { NewVoteForm } from "@/components/sessions/NewVoteForm";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTemplateVisibilityWhere } from "@/lib/template-access";
import type { Item, ListSummary } from "@/types";

export const dynamic = "force-dynamic";

const FEATURED_COUNT = 8;
const PREVIEW_ITEM_COUNT = 4;

interface SelectedListDetails {
  id: string;
  name: string;
  items: Item[];
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function NewVotePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const preselectedListId =
    typeof resolvedSearchParams.templateId === "string" ? resolvedSearchParams.templateId : null;

  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;

  const templates = await prisma.template.findMany({
    where: getTemplateVisibilityWhere(userId),
    include: { _count: { select: { items: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const previewTemplateIds = templates.slice(0, FEATURED_COUNT).map((template) => template.id);
  const previewTemplates =
    previewTemplateIds.length > 0
      ? await prisma.template.findMany({
          where: { id: { in: previewTemplateIds } },
          select: {
            id: true,
            items: {
              take: PREVIEW_ITEM_COUNT,
              orderBy: { sortOrder: "asc" },
              select: { id: true, imageUrl: true, label: true },
            },
          },
        })
      : [];

  const previewsByTemplateId = new Map(
    previewTemplates.map((template) => [template.id, template.items] as const),
  );

  const initialLists: ListSummary[] = templates.map((template) => ({
    id: template.id,
    name: template.name,
    isPublic: template.isPublic,
    _count: { items: template._count.items },
    items: previewsByTemplateId.get(template.id) ?? [],
  }));

  let initialSelectedListDetails: SelectedListDetails | null = null;
  let initialSelectedListUnavailable = false;

  if (preselectedListId) {
    const selected = await prisma.template.findUnique({
      where: { id: preselectedListId },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, label: true, imageUrl: true },
        },
      },
    });

    if (
      selected &&
      !selected.isHidden &&
      (selected.isPublic || (userId && selected.creatorId === userId))
    ) {
      initialSelectedListDetails = {
        id: selected.id,
        name: selected.name,
        items: selected.items,
      };
    } else {
      initialSelectedListUnavailable = true;
    }
  }

  return (
    <NewVoteForm
      initialLists={initialLists}
      initialSelectedListId={preselectedListId}
      initialSelectedListDetails={initialSelectedListDetails}
      initialSelectedListUnavailable={initialSelectedListUnavailable}
    />
  );
}
