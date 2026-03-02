import { NextResponse } from "next/server";
import { validateBody, withHandler } from "@/lib/api-helpers";
import { getRequestAuth, requireRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTemplateVisibilityWhere } from "@/lib/template-access";
import { createTemplateSchema } from "@/lib/validators";

export const GET = withHandler(async (request) => {
  const auth = await getRequestAuth(request);
  const userId = auth?.userId ?? null;
  const templates = await prisma.template.findMany({
    where: getTemplateVisibilityWhere(userId),
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
});

export const POST = withHandler(async (request) => {
  const { name, description, isPublic } = await validateBody(request, createTemplateSchema);
  const { userId: creatorId } = await requireRequestAuth(request);
  const template = await prisma.template.create({
    data: { name, description, creatorId, isPublic: isPublic ?? false },
  });
  return NextResponse.json(template, { status: 201 });
});
