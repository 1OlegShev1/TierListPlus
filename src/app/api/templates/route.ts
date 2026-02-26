import { NextResponse } from "next/server";
import { validateBody, withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createTemplateSchema } from "@/lib/validators";

export const GET = withHandler(async () => {
  const templates = await prisma.template.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
});

export const POST = withHandler(async (request) => {
  const { name, description, creatorId } = await validateBody(request, createTemplateSchema);
  const template = await prisma.template.create({
    data: { name, description, creatorId: creatorId ?? undefined },
  });
  return NextResponse.json(template, { status: 201 });
});
