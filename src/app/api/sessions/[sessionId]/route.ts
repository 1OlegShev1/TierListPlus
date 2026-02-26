import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  const session = await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: body.status,
    },
  });

  return NextResponse.json(session);
}
