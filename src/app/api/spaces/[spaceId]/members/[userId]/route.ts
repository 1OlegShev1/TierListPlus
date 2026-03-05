import { removeSpaceMember } from "@/domain/spaces/service";
import { withHandler } from "@/lib/api-helpers";
import { getRequestAuth } from "@/lib/auth";

export const DELETE = withHandler(async (request, { params }) => {
  const { spaceId, userId } = await params;
  const auth = await getRequestAuth(request);
  const requestUserId = auth?.userId ?? null;
  await removeSpaceMember(spaceId, requestUserId, userId);

  return new Response(null, { status: 204 });
});
