import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionSchema } from "@/lib/validators";
import { generateJoinCode } from "@/lib/nanoid";
import { DEFAULT_TIER_CONFIG } from "@/lib/constants";
import { validateBody, notFound, badRequest } from "@/lib/api-helpers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const sessions = await prisma.session.findMany({
    where: status ? { status: status as "OPEN" | "CLOSED" | "ARCHIVED" } : undefined,
    include: {
      template: { select: { name: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  const data = await validateBody(request, createSessionSchema);
  if (data instanceof NextResponse) return data;

  const { templateId, name, tierConfig, bracketEnabled } = data;

  // Verify template exists and get its items
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!template) return notFound("Template not found");

  if (template.items.length === 0) {
    return badRequest("Template has no items");
  }

  const joinCode = generateJoinCode();

  const session = await prisma.session.create({
    data: {
      name,
      templateId,
      joinCode,
      tierConfig: JSON.parse(JSON.stringify(tierConfig ?? DEFAULT_TIER_CONFIG)),
      bracketEnabled: bracketEnabled ?? false,
      items: {
        create: template.items.map((item) => ({
          templateItemId: item.id,
          label: item.label,
          imageUrl: item.imageUrl,
          sortOrder: item.sortOrder,
        })),
      },
    },
    include: {
      items: true,
      _count: { select: { participants: true } },
    },
  });

  return NextResponse.json(session, { status: 201 });
}
