import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTemplateSchema } from "@/lib/validators";
import { withHandler, validateBody } from "@/lib/api-helpers";

export const GET = withHandler(async () => {
  const templates = await prisma.template.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
});

export const POST = withHandler(async (request) => {
  const data = await validateBody(request, createTemplateSchema);
  const template = await prisma.template.create({ data });
  return NextResponse.json(template, { status: 201 });
});
