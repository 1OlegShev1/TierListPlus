import { NextResponse } from "next/server";
import { notFound, validateBody, withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { addTemplateItemSchema } from "@/lib/validators";

export const POST = withHandler(async (request, { params }) => {
  const { templateId } = await params;
  const data = await validateBody(request, addTemplateItemSchema);

  // Verify template exists and auto-set sortOrder atomically
  const item = await prisma.$transaction(async (tx) => {
    const template = await tx.template.findUnique({
      where: { id: templateId },
      select: { id: true },
    });
    if (!template) notFound("Template not found");

    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const lastItem = await tx.templateItem.findFirst({
        where: { templateId },
        orderBy: { sortOrder: "desc" },
      });
      sortOrder = (lastItem?.sortOrder ?? -1) + 1;
    }

    return tx.templateItem.create({
      data: {
        ...data,
        sortOrder,
        templateId,
      },
    });
  });

  return NextResponse.json(item, { status: 201 });
});
