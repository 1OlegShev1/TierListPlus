import { NextResponse } from "next/server";
import { joinPrivateSpaceByInviteCode } from "@/domain/spaces/service";
import { validateBody, withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";
import { joinSpaceSchema } from "@/lib/validators";

export const POST = withHandler(async (request) => {
  const { userId } = await requireRequestAuth(request);
  const { code, expectedSpaceId } = await validateBody(request, joinSpaceSchema);
  const result = await joinPrivateSpaceByInviteCode(userId, code, expectedSpaceId);
  return NextResponse.json(result);
});
