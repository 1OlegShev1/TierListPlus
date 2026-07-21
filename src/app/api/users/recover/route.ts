import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { linkDeviceToTarget, mergeAccountIntoTarget } from "@/lib/account-linking";
import { notFound, validateBody, withHandler } from "@/lib/api-helpers";
import { getRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { takeRateLimitToken } from "@/lib/rate-limit";
import { getRequestClientKey } from "@/lib/request-client-key";
import {
  createUserSessionToken,
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE,
} from "@/lib/user-session";

const RECOVERY_ATTEMPT_RATE_LIMIT_MAX_REQUESTS = 10;
const RECOVERY_ATTEMPT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const recoverSchema = z.object({
  recoveryCode: z.string().min(1),
  deviceName: z.string().trim().min(1).max(50),
});

export const POST = withHandler(async (request) => {
  const auth = await getRequestAuth(request);
  const rateLimit = takeRateLimitToken({
    key: auth
      ? `recover:device:${auth.deviceId}`
      : getRequestClientKey(request, "recover-anonymous"),
    maxRequests: RECOVERY_ATTEMPT_RATE_LIMIT_MAX_REQUESTS,
    windowMs: RECOVERY_ATTEMPT_RATE_LIMIT_WINDOW_MS,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many recovery attempts. Please wait and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const { recoveryCode, deviceName } = await validateBody(request, recoverSchema);

  const linkCode = await prisma.linkCode.findUnique({
    where: { code: recoveryCode.toUpperCase() },
    select: { id: true, userId: true, expiresAt: true, consumedAt: true },
  });

  if (!linkCode || linkCode.consumedAt || linkCode.expiresAt <= new Date()) {
    notFound("No account found with that recovery code");
  }

  const result = auth
    ? await mergeAccountIntoTarget({
        currentDeviceId: auth.deviceId,
        currentUserId: auth.userId,
        targetUserId: linkCode.userId,
        deviceName,
        linkCodeId: linkCode.id,
      })
    : await linkDeviceToTarget({
        targetUserId: linkCode.userId,
        deviceName,
        linkCodeId: linkCode.id,
      });

  const res = NextResponse.json({ userId: result.userId, deviceId: result.deviceId });
  res.cookies.set(
    USER_SESSION_COOKIE,
    createUserSessionToken(result.deviceId),
    getUserSessionCookieOptions(),
  );
  return res;
});
