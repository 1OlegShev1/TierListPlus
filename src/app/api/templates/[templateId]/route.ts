import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateTemplateSchema } from "@/lib/validators";
import { withHandler, validateBody, notFound } from "@/lib/api-helpers";

export const GET = withHandler(async (_request, { params }) => {
  const { templateId } = await params;
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!template) notFound("Template not found");

  return NextResponse.json(template);
});

export const PATCH = withHandler(async (request, { params }) => {
  const { templateId } = await params;

  const existing = await prisma.template.findUnique({ where: { id: templateId }, select: { id: true } });
  if (!existing) notFound("Template not found");

  const data = await validateBody(request, updateTemplateSchema);

  const template = await prisma.template.update({
    where: { id: templateId },
    data,
  });

  return NextResponse.json(template);
});

export const DELETE = withHandler(async (_request, { params }) => {
  const { templateId } = await params;
  await prisma.template.delete({ where: { id: templateId } });
  return new Response(null, { status: 204 });
});
