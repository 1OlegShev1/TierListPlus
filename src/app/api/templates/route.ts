import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTemplateSchema } from "@/lib/validators";
import { validateBody } from "@/lib/api-helpers";

export async function GET() {
  const templates = await prisma.template.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  const data = await validateBody(request, createTemplateSchema);
  if (data instanceof NextResponse) return data;

  const template = await prisma.template.create({ data });

  return NextResponse.json(template, { status: 201 });
}
