import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ListEditor } from "@/components/templates/ListEditor";
import { canMutateSpaceResource } from "@/lib/api-helpers";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditListPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
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

  if (!list || list.isHidden || !userId) notFound();

  if (list.space) {
    const isSpaceMember = Array.isArray(list.space.members) && list.space.members.length > 0;
    if (list.space.visibility === "PRIVATE" && !isSpaceMember) notFound();
    const isSpaceOwner =
      list.space.creatorId === userId ||
      (Array.isArray(list.space.members) && list.space.members[0]?.role === "OWNER");
    if (!canMutateSpaceResource(list.creatorId, userId, isSpaceOwner)) notFound();
  } else if (list.creatorId !== userId) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Edit List</h1>
      <ListEditor
        listId={templateId}
        spaceId={list.spaceId}
        spaceName={list.space?.name ?? null}
        initialName={list.name}
        initialDescription={list.description ?? ""}
        initialIsPublic={list.isPublic}
        initialItems={list.items}
      />
    </div>
  );
}
