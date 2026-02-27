import { NextResponse } from "next/server";
import { withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import {
  createUserSessionToken,
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE,
} from "@/lib/user-session";

export const POST = withHandler(async () => {
  const user = await prisma.user.create({ data: {} });
  const res = NextResponse.json({ id: user.id }, { status: 201 });
  res.cookies.set(
    USER_SESSION_COOKIE,
    createUserSessionToken(user.id),
    getUserSessionCookieOptions(),
  );
  return res;
});
