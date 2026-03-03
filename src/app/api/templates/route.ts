import { NextResponse } from "next/server";
import { validateBody, withHandler } from "@/lib/api-helpers";
import { getRequestAuth, requireRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTemplateVisibilityWhere } from "@/lib/template-access";
import { createTemplateSchema } from "@/lib/validators";

const PREVIEW_ITEM_COUNT = 4;

export const GET = withHandler(async (request) => {
  const auth = await getRequestAuth(request);
  const userId = auth?.userId ?? null;
  const { searchParams } = new URL(request.url);
  const previewLimitRaw = searchParams.get("previewLimit");
  const previewLimit =
    previewLimitRaw && /^\d+$/.test(previewLimitRaw) ? Number.parseInt(previewLimitRaw, 10) : 0;

  const templates = await prisma.template.findMany({
    where: getTemplateVisibilityWhere(userId),
    include: { _count: { select: { items: true } } },
    orderBy: { updatedAt: "desc" },
  });

  if (previewLimit < 1 || templates.length === 0) {
    return NextResponse.json(templates.map((template) => ({ ...template, items: [] })));
  }

  const previewTemplateIds = templates.slice(0, previewLimit).map((template) => template.id);
  const previewTemplates = await prisma.template.findMany({
    where: { id: { in: previewTemplateIds } },
    select: {
      id: true,
      items: {
        take: PREVIEW_ITEM_COUNT,
        orderBy: { sortOrder: "asc" },
        select: { id: true, imageUrl: true, label: true },
      },
    },
  });
  const previewsByTemplateId = new Map(
    previewTemplates.map((template) => [template.id, template.items] as const),
  );

  return NextResponse.json(
    templates.map((template) => ({
      ...template,
      items: previewsByTemplateId.get(template.id) ?? [],
    })),
  );
});

export const POST = withHandler(async (request) => {
  const { name, description, isPublic } = await validateBody(request, createTemplateSchema);
  const { userId: creatorId } = await requireRequestAuth(request);
  const template = await prisma.template.create({
    data: { name, description, creatorId, isPublic: isPublic ?? false },
  });
  return NextResponse.json(template, { status: 201 });
});
