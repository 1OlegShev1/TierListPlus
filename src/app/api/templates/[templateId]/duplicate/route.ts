import { NextResponse } from "next/server";
import { notFound, requireUserId, withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { canAccessTemplate } from "@/lib/template-access";

export const POST = withHandler(async (request, { params }) => {
  const { templateId } = await params;
  const requestUserId = requireUserId(request);

  const source = await prisma.template.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!source) notFound("Template not found");
  if (!canAccessTemplate(source, requestUserId)) {
    notFound("Template not found");
  }

  const duplicated = await prisma.template.create({
    data: {
      name: `${source.name} (Copy)`,
      description: source.description,
      creatorId: requestUserId,
      isPublic: false,
      items: {
        create: source.items.map((item) => ({
          label: item.label,
          imageUrl: item.imageUrl,
          sortOrder: item.sortOrder,
        })),
      },
    },
  });

  return NextResponse.json({ id: duplicated.id }, { status: 201 });
});
