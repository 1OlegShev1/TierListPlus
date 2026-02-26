import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateTemplateItemSchema } from "@/lib/validators";
import { withHandler, validateBody } from "@/lib/api-helpers";

export const PATCH = withHandler(async (request, { params }) => {
  const { templateId, itemId } = await params;
  const data = await validateBody(request, updateTemplateItemSchema);

  const item = await prisma.templateItem.update({
    where: { id: itemId, templateId },
    data,
  });

  return NextResponse.json(item);
});

export const DELETE = withHandler(async (_request, { params }) => {
  const { templateId, itemId } = await params;
  await prisma.templateItem.delete({
    where: { id: itemId, templateId },
  });
  return new Response(null, { status: 204 });
});
