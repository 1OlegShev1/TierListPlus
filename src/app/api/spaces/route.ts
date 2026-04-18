import { NextResponse } from "next/server";
import { createSpace, listSpacesForUser } from "@/domain/spaces/service";
import { validateBody, withHandler } from "@/lib/api-helpers";
import { getRequestAuth, requireRequestAuth } from "@/lib/auth";
import { createSpaceSchema } from "@/lib/validators";

function parsePositiveInt(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return parsed;
}

export const GET = withHandler(async (request) => {
  const auth = await getRequestAuth(request);
  const userId = auth?.userId ?? null;
  const { searchParams } = new URL(request.url);
  const page = parsePositiveInt(searchParams.get("page"));
  const pageSize = parsePositiveInt(searchParams.get("pageSize"));

  const spaces =
    page || pageSize
      ? await listSpacesForUser(userId, auth?.role ?? null, {
          ...(page ? { page } : {}),
          ...(pageSize ? { pageSize } : {}),
        })
      : await listSpacesForUser(userId, auth?.role ?? null);
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
