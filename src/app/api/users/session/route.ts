import { NextResponse } from "next/server";
import { withHandler } from "@/lib/api-helpers";
import { getRequestAuth, getRequestTokenVersion } from "@/lib/auth";
import {
  createUserSessionToken,
  getClearedUserSessionCookieOptions,
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE,
} from "@/lib/user-session";

export const GET = withHandler(async (request) => {
  const tokenVersion = getRequestTokenVersion(request);
  const auth = await getRequestAuth(request);

  if (!auth) {
    const res = NextResponse.json({ error: "User identity required" }, { status: 401 });
    res.cookies.set(USER_SESSION_COOKIE, "", getClearedUserSessionCookieOptions());
    return res;
  }

  const res = NextResponse.json({
    id: auth.userId,
    userId: auth.userId,
    deviceId: auth.deviceId,
    deviceName: auth.device.displayName,
  });

  if (tokenVersion === 1) {
    res.cookies.set(
      USER_SESSION_COOKIE,
      createUserSessionToken(auth.deviceId),
      getUserSessionCookieOptions(),
    );
  }

  return res;
});
