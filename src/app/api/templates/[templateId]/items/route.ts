import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addTemplateItemSchema } from "@/lib/validators";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  const body = await request.json();
  const parsed = addTemplateItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Auto-set sortOrder if not provided
  let sortOrder = parsed.data.sortOrder;
  if (sortOrder === undefined) {
    const lastItem = await prisma.templateItem.findFirst({
      where: { templateId },
      orderBy: { sortOrder: "desc" },
    });
    sortOrder = (lastItem?.sortOrder ?? -1) + 1;
  }

  const item = await prisma.templateItem.create({
    data: {
      ...parsed.data,
      sortOrder,
      templateId,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
