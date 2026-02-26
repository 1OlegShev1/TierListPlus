import { NextResponse } from "next/server";
import { badRequest, notFound, validateBody, withHandler } from "@/lib/api-helpers";
import { DEFAULT_TIER_CONFIG } from "@/lib/constants";
import { generateJoinCode } from "@/lib/nanoid";
import { prisma } from "@/lib/prisma";
import { createSessionSchema } from "@/lib/validators";

const VALID_STATUSES = new Set(["OPEN", "CLOSED", "ARCHIVED"]);

export const GET = withHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  if (status && !VALID_STATUSES.has(status)) {
    badRequest("Invalid status filter. Must be OPEN, CLOSED, or ARCHIVED");
  }

  const sessions = await prisma.session.findMany({
    where: status ? { status: status as "OPEN" | "CLOSED" | "ARCHIVED" } : undefined,
    include: {
      template: { select: { name: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sessions);
});

export const POST = withHandler(async (request) => {
  const data = await validateBody(request, createSessionSchema);

  const { templateId, name, tierConfig, bracketEnabled, nickname, creatorId } = data;

  // Verify template exists and get its items
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!template) notFound("Template not found");
  if (template.items.length === 0) badRequest("Template has no items");

  const joinCode = generateJoinCode();

  const session = await prisma.session.create({
    data: {
      name,
      templateId,
      joinCode,
      creatorId: creatorId ?? undefined,
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

  // Auto-join creator as participant if nickname provided
  let participantId: string | null = null;
  let participantNickname: string | null = null;

  if (nickname) {
    const participant = await prisma.participant.create({
      data: { sessionId: session.id, nickname, userId: creatorId ?? undefined },
    });
    participantId = participant.id;
    participantNickname = participant.nickname;
  }

  return NextResponse.json({ ...session, participantId, participantNickname }, { status: 201 });
});
