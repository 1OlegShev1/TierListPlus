import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { TemplateEditor } from "@/components/templates/TemplateEditor";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!template) notFound();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Edit Template</h1>
      <TemplateEditor
        templateId={templateId}
        initialName={template.name}
        initialDescription={template.description ?? ""}
        initialItems={template.items}
      />
    </div>
  );
}
