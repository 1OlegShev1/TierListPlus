import { NextResponse } from "next/server";
import { createSpaceTemplate, listSpaceTemplates } from "@/domain/spaces/service";
import { validateBody, withHandler } from "@/lib/api-helpers";
import { getRequestAuth } from "@/lib/auth";
import { createTemplateSchema } from "@/lib/validators";

export const GET = withHandler(async (request, { params }) => {
  const { spaceId } = await params;
  const auth = await getRequestAuth(request);
  const requestUserId = auth?.userId ?? null;
  const templates = await listSpaceTemplates(spaceId, requestUserId);

  return NextResponse.json(templates);
});

export const POST = withHandler(async (request, { params }) => {
  const { spaceId } = await params;
  const auth = await getRequestAuth(request);
  const requestUserId = auth?.userId ?? null;
  const { name, description } = await validateBody(request, createTemplateSchema);
  const template = await createSpaceTemplate(spaceId, requestUserId, {
    name,
    ...(description != null ? { description } : {}),
  });

  return NextResponse.json(template, { status: 201 });
});
