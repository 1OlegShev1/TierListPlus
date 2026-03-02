import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteTemplateButton } from "@/components/templates/DeleteTemplateButton";
import { DuplicateTemplateButton } from "@/components/templates/DuplicateTemplateButton";
import { buttonVariants } from "@/components/ui/Button";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTemplate, isTemplateOwner } from "@/lib/template-access";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const cookieStore = await cookies();
  const auth = await getCookieAuth(cookieStore);
  const userId = auth?.userId ?? null;
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!template || !canAccessTemplate(template, userId)) notFound();

  const owner = isTemplateOwner(template, userId);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{template.name}</h1>
          {template.description && (
            <p className="mt-1 text-sm text-neutral-400">{template.description}</p>
          )}
          <p className="mt-1 text-xs text-neutral-500">
            {template.isPublic ? "Public template" : owner ? "Private to you" : "Private"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!owner && template.isPublic && <DuplicateTemplateButton templateId={templateId} />}
          {owner && <DeleteTemplateButton templateId={templateId} creatorId={template.creatorId} />}
          {owner && (
            <Link href={`/templates/${templateId}/edit`} className={buttonVariants.secondary}>
              Edit
            </Link>
          )}
          <Link href={`/sessions/new?templateId=${templateId}`} className={buttonVariants.primary}>
            Start Session
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {template.items.map((item) => (
          <div key={item.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-2">
            <img
              src={item.imageUrl}
              alt={item.label}
              className="aspect-square w-full rounded object-cover"
            />
            <p className="mt-1 truncate text-center text-xs text-neutral-300">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
