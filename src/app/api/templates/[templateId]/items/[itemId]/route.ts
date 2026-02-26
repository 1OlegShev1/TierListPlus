import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateTemplateItemSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ templateId: string; itemId: string }> }
) {
  const { templateId, itemId } = await params;
  const body = await request.json();
  const parsed = updateTemplateItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.templateItem.update({
    where: { id: itemId, templateId },
    data: parsed.data,
  });

  return NextResponse.json(item);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ templateId: string; itemId: string }> }
) {
  const { templateId, itemId } = await params;
  await prisma.templateItem.delete({
    where: { id: itemId, templateId },
  });
  return new Response(null, { status: 204 });
}
