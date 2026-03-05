import { NextResponse } from "next/server";
import { joinOpenSpace, listSpaceMembers } from "@/domain/spaces/service";
import { withHandler } from "@/lib/api-helpers";
import { getRequestAuth, requireRequestAuth } from "@/lib/auth";

export const GET = withHandler(async (request, { params }) => {
  const { spaceId } = await params;
  const auth = await getRequestAuth(request);
  const requestUserId = auth?.userId ?? null;
  const { members } = await listSpaceMembers(spaceId, requestUserId);

  return NextResponse.json({ members });
});

export const POST = withHandler(async (request, { params }) => {
  const { spaceId } = await params;
  const { userId } = await requireRequestAuth(request);
  const result = await joinOpenSpace(spaceId, userId);

  return NextResponse.json(result, { status: result.joined ? 201 : 200 });
});
