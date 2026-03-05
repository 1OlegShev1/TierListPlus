import { NextResponse } from "next/server";
import { createSpace, listSpacesForUser } from "@/domain/spaces/service";
import { validateBody, withHandler } from "@/lib/api-helpers";
import { getRequestAuth, requireRequestAuth } from "@/lib/auth";
import { createSpaceSchema } from "@/lib/validators";

export const GET = withHandler(async (request) => {
  const auth = await getRequestAuth(request);
  const userId = auth?.userId ?? null;
  const spaces = await listSpacesForUser(userId);
  return NextResponse.json(spaces);
});

export const POST = withHandler(async (request) => {
  const { userId } = await requireRequestAuth(request);
  const { name, description, logoUrl, accentColor, visibility } = await validateBody(
    request,
    createSpaceSchema,
  );
  const space = await createSpace({
    ownerUserId: userId,
    name,
    ...(description != null ? { description } : {}),
    ...(logoUrl != null ? { logoUrl } : {}),
    ...(accentColor != null ? { accentColor } : {}),
    visibility: visibility ?? "PRIVATE",
  });

  return NextResponse.json(space, { status: 201 });
});
