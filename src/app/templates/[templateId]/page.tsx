import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteListButton } from "@/components/templates/DeleteListButton";
import { DuplicateListButton } from "@/components/templates/DuplicateListButton";
import { ListDetailItemsGrid } from "@/components/templates/ListDetailItemsGrid";
import { ListRankingPreviewTeaser } from "@/components/templates/ListRankingPreviewTeaser";
import { StartVoteFromTemplateButton } from "@/components/templates/StartVoteFromTemplateButton";
import { TemplateBackLink } from "@/components/templates/TemplateBackLink";
import { buttonVariants } from "@/components/ui/Button";
import { canMutateSpaceResource } from "@/lib/api-helpers";
import { getCookieAuth } from "@/lib/auth";
import { getSuggestedNicknameForUser } from "@/lib/nickname-suggestion";
import { prisma } from "@/lib/prisma";
import { canAccessTemplate, isTemplateOwner } from "@/lib/template-access";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const { templateId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;
  const list = await prisma.template.findUnique({
    where: { id: templateId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      space: {
        select: {
          id: true,
          name: true,
          visibility: true,
          creatorId: true,
          members: userId
            ? {
                where: { userId },
                select: { role: true },
                take: 1,
              }
            : false,
        },
      },
    },
  });

  if (!list) notFound();

  if (list.spaceId && list.space) {
    const isSpaceMember = Array.isArray(list.space.members) && list.space.members.length > 0;
    if (list.space.visibility === "PRIVATE" && !isSpaceMember) notFound();
  } else if (!canAccessTemplate(list, userId)) {
    notFound();
  }
  const suggestedNickname = await getSuggestedNicknameForUser(userId);

  const owner = isTemplateOwner(list, userId);
  const isSpaceOwner =
    !!userId &&
    !!list.space &&
    (list.space.creatorId === userId ||
      (Array.isArray(list.space.members) && list.space.members[0]?.role === "OWNER"));
  const canManage = canMutateSpaceResource(list.creatorId, userId, isSpaceOwner);
  const from = typeof resolvedSearchParams.from === "string" ? resolvedSearchParams.from : null;
  const returnSpaceId =
    typeof resolvedSearchParams.returnSpaceId === "string"
      ? resolvedSearchParams.returnSpaceId
      : null;
  const fromSessionsNew = from === "sessions-new";
  const fallbackBackHref = returnSpaceId
    ? `/sessions/new?spaceId=${encodeURIComponent(returnSpaceId)}`
    : "/sessions/new";
  const backHref = list.space ? `/spaces/${list.space.id}#lists` : "/templates";
  const backLabel = list.space ? "Back to Space" : "Back to Lists";

  return (
    <div className="space-y-4">
      {fromSessionsNew ? (
        <TemplateBackLink
          fallbackHref={fallbackBackHref}
          label="Back to Start Ranking"
          className={`${buttonVariants.ghost} inline-flex items-center`}
        />
      ) : (
        <Link href={backHref} className={`${buttonVariants.ghost} inline-flex items-center`}>
          {`← ${backLabel}`}
        </Link>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{list.name}</h1>
          {list.description && (
            <p className="mt-1 text-sm text-[var(--fg-muted)]">{list.description}</p>
          )}
          <p className="mt-1 text-xs text-[var(--fg-subtle)]">
            {list.space
              ? `${list.space.visibility === "OPEN" ? "Open" : "Private"} space starter list`
              : list.isPublic
                ? "Public starter list"
                : owner
                  ? "Private starter list (only you)"
                  : "Private starter list"}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto sm:shrink-0">
          {!canManage && (list.isPublic || !!list.spaceId) && (
            <DuplicateListButton listId={templateId} />
          )}
          {canManage && (
            <Link href={`/templates/${templateId}/edit`} className={buttonVariants.secondary}>
              Edit
            </Link>
          )}
          <StartVoteFromTemplateButton
            templateId={templateId}
            templateName={list.name}
            spaceId={list.spaceId}
            initialNickname={suggestedNickname}
          />
          {canManage && (
            <DeleteListButton listId={templateId} creatorId={list.creatorId} canDeleteOverride />
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--fg-secondary)]">
        <p className="font-medium text-[var(--fg-primary)]">
          This is a starter list, not a live ranking.
        </p>
        <p className="mt-1 text-[var(--fg-muted)]">
          Use this list to define picks. Ranking happens after you start a ranking.
        </p>
      </div>

      <ListRankingPreviewTeaser items={list.items} />

      <ListDetailItemsGrid items={list.items} />
    </div>
  );
}
