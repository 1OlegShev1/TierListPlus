import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTemplateSchema } from "@/lib/validators";

export async function GET() {
  const templates = await prisma.template.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const template = await prisma.template.create({
    data: parsed.data,
  });

  return NextResponse.json(template, { status: 201 });
}
