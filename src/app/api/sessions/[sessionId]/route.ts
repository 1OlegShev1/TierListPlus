import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tierConfigSchema } from "@/lib/validators";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      template: { select: { name: true } },
      items: { orderBy: { sortOrder: "asc" } },
      participants: { orderBy: { createdAt: "asc" } },
      _count: { select: { participants: true } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};

  if (body.status) {
    const validStatuses = ["OPEN", "CLOSED", "ARCHIVED"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be OPEN, CLOSED, or ARCHIVED" },
        { status: 400 }
      );
    }
    data.status = body.status;
  }

  if (body.tierConfig) {
    const parsed = tierConfigSchema.safeParse(body.tierConfig);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid tier config", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    data.tierConfig = JSON.parse(JSON.stringify(parsed.data));
  }

  const session = await prisma.session.update({
    where: { id: sessionId },
    data,
  });

  return NextResponse.json(session);
}
