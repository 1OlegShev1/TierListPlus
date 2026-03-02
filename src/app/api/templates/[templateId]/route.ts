import { NextResponse } from "next/server";
import { badRequest, notFound, requireOwner, validateBody, withHandler } from "@/lib/api-helpers";
import { getRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTemplate } from "@/lib/template-access";
import { updateTemplateSchema } from "@/lib/validators";

export const GET = withHandler(async (request, { params }) => {
  const { templateId } = await params;
  const auth = await getRequestAuth(request);
  const userId = auth?.userId ?? null;
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!template) notFound("Template not found");
  if (!canAccessTemplate(template, userId)) {
    notFound("Template not found");
  }

  return NextResponse.json(template);
});

export const PATCH = withHandler(async (request, { params }) => {
  const { templateId } = await params;
  const auth = await getRequestAuth(request);
  const userId = auth?.userId ?? null;

  const existing = await prisma.template.findUnique({
    where: { id: templateId },
    select: { id: true, creatorId: true },
  });
  if (!existing) notFound("Template not found");
  requireOwner(existing.creatorId, userId);

  const data = await validateBody(request, updateTemplateSchema);

  const template = await prisma.template.update({
    where: { id: templateId },
    data,
  });

  return NextResponse.json(template);
});

export const DELETE = withHandler(async (request, { params }) => {
  const { templateId } = await params;
  const auth = await getRequestAuth(request);
  const userId = auth?.userId ?? null;

  const existing = await prisma.template.findUnique({
    where: { id: templateId },
    select: { id: true, creatorId: true, _count: { select: { sessions: true } } },
  });
  if (!existing) notFound("Template not found");
  requireOwner(existing.creatorId, userId);

  if (existing._count.sessions > 0) {
    badRequest(
      `Cannot delete: ${existing._count.sessions} session(s) use this template. Delete those sessions first.`,
    );
  }

  await prisma.template.delete({ where: { id: templateId } });
  return new Response(null, { status: 204 });
});
