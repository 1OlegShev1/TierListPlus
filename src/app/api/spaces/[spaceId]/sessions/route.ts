import { NextResponse } from "next/server";
import {
  assertValidSessionStatus,
  createSession,
  listSpaceSessions,
} from "@/domain/sessions/service";
import { forbidden, requireSpaceMember, validateBody, withHandler } from "@/lib/api-helpers";
import { getRequestAuth } from "@/lib/auth";
import { createSessionSchema } from "@/lib/validators";

export const GET = withHandler(async (request, { params }) => {
  const { spaceId } = await params;
  const auth = await getRequestAuth(request);
  const requestUserId = auth?.userId ?? null;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  assertValidSessionStatus(status);

  const sessions = await listSpaceSessions(spaceId, requestUserId, status, auth?.role ?? null);

  return NextResponse.json(sessions);
});

export const POST = withHandler(async (request, { params }) => {
  const { spaceId } = await params;
  const { requestUserId: creatorId } = await requireSpaceMember(request, spaceId);
  if (!creatorId) {
    forbidden("You must join this space first");
  }
  const data = await validateBody(request, createSessionSchema);
  const session = await createSession({
    creatorId,
    templateId: data.templateId,
    name: data.name,
    tierConfig: data.tierConfig,
    nickname: data.nickname,
    spaceId,
    isPrivate: true,
  });
  return NextResponse.json(session, { status: 201 });
});
