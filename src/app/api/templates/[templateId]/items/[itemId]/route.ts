import { NextResponse } from "next/server";
import { notFound, requireOwner, validateBody, withHandler } from "@/lib/api-helpers";
import { getRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateTemplateItemSchema } from "@/lib/validators";

export const PATCH = withHandler(async (request, { params }) => {
  const { templateId, itemId } = await params;
  const auth = await getRequestAuth(request);
  const userId = auth?.userId ?? null;

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: { creatorId: true },
  });
  if (!template) notFound("Template not found");
  requireOwner(template.creatorId, userId);

  const existing = await prisma.templateItem.findFirst({
    where: { id: itemId, templateId },
    select: { id: true },
  });
  if (!existing) notFound("Template item not found");

  const data = await validateBody(request, updateTemplateItemSchema);

  const item = await prisma.templateItem.update({
    where: { id: itemId, templateId },
    data,
  });

  return NextResponse.json(item);
});

export const DELETE = withHandler(async (_request, { params }) => {
  const { templateId, itemId } = await params;
  const auth = await getRequestAuth(_request);
  const userId = auth?.userId ?? null;

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: { creatorId: true },
  });
  if (!template) notFound("Template not found");
  requireOwner(template.creatorId, userId);

  const existing = await prisma.templateItem.findFirst({
    where: { id: itemId, templateId },
    select: { id: true },
  });
  if (!existing) notFound("Template item not found");

  await prisma.templateItem.delete({ where: { id: itemId } });
  return new Response(null, { status: 204 });
});
