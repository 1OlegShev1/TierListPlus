import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { NewVoteForm } from "@/components/sessions/NewVoteForm";
import { getCookieAuth } from "@/lib/auth";
import { getSuggestedNicknameForUser } from "@/lib/nickname-suggestion";
import { prisma } from "@/lib/prisma";
import { canReadSpace, getSpaceAccessForUser } from "@/lib/space";
import { getTemplateVisibilityWhere } from "@/lib/template-access";
import type { ListSummary } from "@/types";

export const dynamic = "force-dynamic";

const FEATURED_COUNT = 8;
const PREVIEW_ITEM_COUNT = 4;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function NewVotePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const spaceId =
    typeof resolvedSearchParams.spaceId === "string" ? resolvedSearchParams.spaceId : null;

  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;
  const role = auth?.role ?? null;

  let accessSpaceId: string | null = null;
  if (spaceId) {
    const spaceAccess = await getSpaceAccessForUser(spaceId, userId, role);
    if (!spaceAccess) notFound();
    if (!canReadSpace(spaceAccess.visibility, spaceAccess.isMember)) notFound();
    if (!spaceAccess.isMember) {
      redirect(`/spaces/${spaceAccess.id}`);
    }
    accessSpaceId = spaceAccess.id;
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

  return (
    <NewVoteForm
      spaceId={accessSpaceId}
      initialNickname={suggestedNickname}
      initialLists={initialLists}
    />
  );
}
