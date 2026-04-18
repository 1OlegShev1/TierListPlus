import { NextResponse } from "next/server";
import { getPrivateSpaceInvite, rotatePrivateSpaceInvite } from "@/domain/spaces/service";
import { withHandler } from "@/lib/api-helpers";
import { getRequestAuth } from "@/lib/auth";

export const GET = withHandler(async (request, { params }) => {
  const { spaceId } = await params;
  const auth = await getRequestAuth(request);
  const requestUserId = auth?.userId ?? null;
  const result = await getPrivateSpaceInvite(spaceId, requestUserId, auth?.role ?? null);
  return NextResponse.json(result);
});

export const POST = withHandler(async (request, { params }) => {
  const { spaceId } = await params;
  const auth = await getRequestAuth(request);
  const requestUserId = auth?.userId ?? null;
  const invite = await rotatePrivateSpaceInvite(spaceId, requestUserId, auth?.role ?? null);
  return NextResponse.json(
    {
      code: invite.code,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    },
    { status: 201 },
  );
});
