import { NextResponse } from "next/server";
import { getSpaceTemplate } from "@/domain/spaces/service";
import { withHandler } from "@/lib/api-helpers";
import { getRequestAuth } from "@/lib/auth";

export const GET = withHandler(async (request, { params }) => {
  const { spaceId, templateId } = await params;
  const auth = await getRequestAuth(request);
  const requestUserId = auth?.userId ?? null;
  const template = await getSpaceTemplate(spaceId, templateId, requestUserId, auth?.role ?? null);
  return NextResponse.json(template);
});
