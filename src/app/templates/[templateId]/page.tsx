import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteListButton } from "@/components/templates/DeleteListButton";
import { DuplicateListButton } from "@/components/templates/DuplicateListButton";
import { buttonVariants } from "@/components/ui/Button";
import { ItemArtwork } from "@/components/ui/ItemArtwork";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTemplate, isTemplateOwner } from "@/lib/template-access";

export default async function ListDetailPage({
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

  if (!list || !canAccessTemplate(list, userId)) notFound();

  const owner = isTemplateOwner(list, userId);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{list.name}</h1>
          {list.description && <p className="mt-1 text-sm text-neutral-400">{list.description}</p>}
          <p className="mt-1 text-xs text-neutral-500">
            {list.isPublic ? "Public list" : owner ? "Private to you" : "Private list"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!owner && list.isPublic && <DuplicateListButton listId={templateId} />}
          {owner && <DeleteListButton listId={templateId} creatorId={list.creatorId} />}
          {owner && (
            <Link href={`/templates/${templateId}/edit`} className={buttonVariants.secondary}>
              Edit
            </Link>
          )}
          <Link href={`/sessions/new?templateId=${templateId}`} className={buttonVariants.primary}>
            Start Vote
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {list.items.map((item) => (
          <div key={item.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-2">
            <ItemArtwork
              src={item.imageUrl}
              alt={item.label}
              className="aspect-square w-full rounded"
              presentation="ambient"
              inset="compact"
            />
            <p className="mt-1 truncate text-center text-xs text-neutral-300">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
