import { NextResponse } from "next/server";
import { duplicateTemplateForUser } from "@/domain/templates/service";
import { withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";

export const POST = withHandler(async (request, { params }) => {
  const { templateId } = await params;
  const { userId: requestUserId } = await requireRequestAuth(request);
  const duplicated = await duplicateTemplateForUser(templateId, requestUserId);
  return NextResponse.json(duplicated, { status: 201 });
});
