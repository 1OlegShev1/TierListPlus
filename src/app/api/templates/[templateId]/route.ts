import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateTemplateSchema } from "@/lib/validators";
import { validateBody, notFound } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!template) return notFound("Template not found");

  return NextResponse.json(template);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  const data = await validateBody(request, updateTemplateSchema);
  if (data instanceof NextResponse) return data;

  const template = await prisma.template.update({
    where: { id: templateId },
    data,
  });

  return NextResponse.json(template);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  await prisma.template.delete({ where: { id: templateId } });
  return new Response(null, { status: 204 });
}
