import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ListEditor } from "@/components/templates/ListEditor";
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
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!list || list.isHidden || !userId || list.creatorId !== userId) notFound();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Edit List</h1>
      <ListEditor
        listId={templateId}
        initialName={list.name}
        initialDescription={list.description ?? ""}
        initialIsPublic={list.isPublic}
        initialItems={list.items}
      />
    </div>
  );
}
