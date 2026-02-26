import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateTemplateItemSchema } from "@/lib/validators";
import { validateBody } from "@/lib/api-helpers";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ templateId: string; itemId: string }> }
) {
  const { templateId, itemId } = await params;
  const data = await validateBody(request, updateTemplateItemSchema);
  if (data instanceof NextResponse) return data;

  const item = await prisma.templateItem.update({
    where: { id: itemId, templateId },
    data,
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
