import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { TemplateEditor } from "@/components/templates/TemplateEditor";
import { getCookieAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditTemplatePage({
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

  if (!template || !userId || template.creatorId !== userId) notFound();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Edit Template</h1>
      <TemplateEditor
        templateId={templateId}
        initialName={template.name}
        initialDescription={template.description ?? ""}
        initialIsPublic={template.isPublic}
        initialItems={template.items}
      />
    </div>
  );
}
