import { NextResponse } from "next/server";
import { importTemplateIntoSpace } from "@/domain/spaces/service";
import { validateBody, withHandler } from "@/lib/api-helpers";
import { getRequestAuth } from "@/lib/auth";
import { importSpaceTemplateSchema } from "@/lib/validators";

export const POST = withHandler(async (request, { params }) => {
  const { spaceId } = await params;
  const auth = await getRequestAuth(request);
  const requestUserId = auth?.userId ?? null;
  const { sourceTemplateId } = await validateBody(request, importSpaceTemplateSchema);

  const template = await importTemplateIntoSpace(
    spaceId,
    requestUserId,
    sourceTemplateId,
    auth?.role ?? null,
  );
  return NextResponse.json(template, { status: 201 });
});
