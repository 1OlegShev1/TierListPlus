import { NextResponse } from "next/server";
import { getSpaceDetails, updateSpace } from "@/domain/spaces/service";
import { validateBody, withHandler } from "@/lib/api-helpers";
import { getRequestAuth } from "@/lib/auth";
import { updateSpaceSchema } from "@/lib/validators";

export const GET = withHandler(async (request, { params }) => {
  const { spaceId } = await params;
  const auth = await getRequestAuth(request);
  const requestUserId = auth?.userId ?? null;
  const space = await getSpaceDetails(spaceId, requestUserId, auth?.role ?? null);
  return NextResponse.json(space);
});

export const PATCH = withHandler(async (request, { params }) => {
  const { spaceId } = await params;
  const auth = await getRequestAuth(request);
  const requestUserId = auth?.userId ?? null;
  const { name, description, logoUrl, accentColor, visibility } = await validateBody(
    request,
    updateSpaceSchema,
  );

  const updated = await updateSpace(
    spaceId,
    requestUserId,
    {
      ...(name != null ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(logoUrl !== undefined ? { logoUrl } : {}),
      ...(accentColor != null ? { accentColor } : {}),
      ...(visibility != null ? { visibility } : {}),
    },
    auth?.role ?? null,
  );

  return NextResponse.json(updated);
});
