import { leaveSpace } from "@/domain/spaces/service";
import { withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";

export const DELETE = withHandler(async (request, { params }) => {
  const { spaceId } = await params;
  const { userId } = await requireRequestAuth(request);
  await leaveSpace(spaceId, userId);

  return new Response(null, { status: 204 });
});
