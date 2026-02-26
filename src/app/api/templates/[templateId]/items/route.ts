import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addTemplateItemSchema } from "@/lib/validators";
import { validateBody } from "@/lib/api-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  const data = await validateBody(request, addTemplateItemSchema);
  if (data instanceof NextResponse) return data;

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
}
