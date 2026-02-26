import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateSessionSchema } from "@/lib/validators";
import { validateBody, notFound } from "@/lib/api-helpers";

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

  if (!session) return notFound("Session not found");

  return NextResponse.json(session);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const data = await validateBody(request, updateSessionSchema);
  if (data instanceof NextResponse) return data;

  const updateData: Record<string, unknown> = {};
  if (data.status) updateData.status = data.status;
  if (data.tierConfig) updateData.tierConfig = JSON.parse(JSON.stringify(data.tierConfig));

  const session = await prisma.session.update({
    where: { id: sessionId },
    data: updateData,
  });

  return NextResponse.json(session);
}
