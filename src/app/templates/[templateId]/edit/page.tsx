import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { TemplateEditor } from "@/components/templates/TemplateEditor";
import { prisma } from "@/lib/prisma";
import { USER_SESSION_COOKIE, verifyUserSessionToken } from "@/lib/user-session";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const cookieStore = await cookies();
  const userId = verifyUserSessionToken(cookieStore.get(USER_SESSION_COOKIE)?.value ?? "");
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
