import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { NewVoteForm } from "@/components/sessions/NewVoteForm";
import { getCookieAuth } from "@/lib/auth";
import { getSuggestedNicknameForUser } from "@/lib/nickname-suggestion";
import { prisma } from "@/lib/prisma";
import { canReadSpace, getSpaceAccessForUser } from "@/lib/space";
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
  const spaceId =
    typeof resolvedSearchParams.spaceId === "string" ? resolvedSearchParams.spaceId : null;

  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;

  let accessSpaceId: string | null = null;
  let accessSpaceName: string | null = null;
  if (spaceId) {
    const spaceAccess = await getSpaceAccessForUser(spaceId, userId);
    if (!spaceAccess) notFound();
    if (!canReadSpace(spaceAccess.visibility, spaceAccess.isMember)) notFound();
    if (!spaceAccess.isMember) {
      redirect(`/spaces/${spaceAccess.id}`);
    }
    accessSpaceId = spaceAccess.id;
    accessSpaceName = spaceAccess.name;
  }
  const suggestedNickname = await getSuggestedNicknameForUser(userId);

  const templates = await prisma.template.findMany({
    where: accessSpaceId
      ? {
          OR: [{ spaceId: accessSpaceId, isHidden: false }, getTemplateVisibilityWhere(userId)],
        }
      : getTemplateVisibilityWhere(userId),
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
    origin: accessSpaceId
      ? template.spaceId === accessSpaceId
        ? "SPACE"
        : userId && template.creatorId === userId
          ? "PERSONAL"
          : "PUBLIC"
      : userId && template.creatorId === userId
        ? "PERSONAL"
        : "PUBLIC",
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
      (selected.spaceId
        ? selected.spaceId === accessSpaceId
        : selected.isPublic || (userId && selected.creatorId === userId))
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
      spaceId={accessSpaceId}
      spaceName={accessSpaceName}
      initialNickname={suggestedNickname}
      initialLists={initialLists}
      initialSelectedListId={preselectedListId}
      initialSelectedListDetails={initialSelectedListDetails}
      initialSelectedListUnavailable={initialSelectedListUnavailable}
    />
  );
}
