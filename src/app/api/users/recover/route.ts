import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { notFound, validateBody, withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import {
  createUserSessionToken,
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE,
} from "@/lib/user-session";

const recoverSchema = z.object({
  recoveryCode: z.string().min(1),
});

export const POST = withHandler(async (request) => {
  const { recoveryCode } = await validateBody(request, recoverSchema);

  const user = await prisma.user.findUnique({
    where: { recoveryCode: recoveryCode.toUpperCase() },
    select: { id: true },
  });

  if (!user) notFound("No account found with that recovery code");

  const res = NextResponse.json({ userId: user.id });
  res.cookies.set(
    USER_SESSION_COOKIE,
    createUserSessionToken(user.id),
    getUserSessionCookieOptions(),
  );
  return res;
});
