import { NextResponse } from "next/server";
import { listPersonalTemplates } from "@/domain/templates/service";
import { validateBody, withHandler } from "@/lib/api-helpers";
import { getRequestAuth, requireRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTemplateSchema } from "@/lib/validators";

export const GET = withHandler(async (request) => {
  const auth = await getRequestAuth(request);
  const userId = auth?.userId ?? null;
  const { searchParams } = new URL(request.url);
  const previewLimitRaw = searchParams.get("previewLimit");
  const previewLimit =
    previewLimitRaw && /^\d+$/.test(previewLimitRaw) ? Number.parseInt(previewLimitRaw, 10) : 0;
  const templates = await listPersonalTemplates(userId, previewLimit);
  return NextResponse.json(templates);
});

export const POST = withHandler(async (request) => {
  const { name, description, isPublic } = await validateBody(request, createTemplateSchema);
  const { userId: creatorId } = await requireRequestAuth(request);
  const template = await prisma.template.create({
    data: { name, description, creatorId, isPublic: isPublic ?? false },
  });
  return NextResponse.json(template, { status: 201 });
});
