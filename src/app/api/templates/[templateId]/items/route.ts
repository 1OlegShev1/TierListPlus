import { NextResponse } from "next/server";
import { validateBody, withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { addTemplateItemSchema } from "@/lib/validators";

export const POST = withHandler(async (request, { params }) => {
  const { templateId } = await params;
  const data = await validateBody(request, addTemplateItemSchema);

  // Auto-set sortOrder if not provided
  let sortOrder = data.sortOrder;
  if (sortOrder === undefined) {
    const lastItem = await prisma.templateItem.findFirst({
      where: { templateId },
      orderBy: { sortOrder: "desc" },
    });
    sortOrder = (lastItem?.sortOrder ?? -1) + 1;
  }

  const item = await prisma.templateItem.create({
    data: {
      ...data,
      sortOrder,
      templateId,
    },
  });

  return NextResponse.json(item, { status: 201 });
});
