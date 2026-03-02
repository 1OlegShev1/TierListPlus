import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { mergeAccountIntoTarget } from "@/lib/account-linking";
import { badRequest, notFound, validateBody, withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createUserSessionToken,
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE,
} from "@/lib/user-session";

const recoverSchema = z.object({
  recoveryCode: z.string().min(1),
  deviceName: z.string().trim().min(1).max(50),
});

export const POST = withHandler(async (request) => {
  const auth = await requireRequestAuth(request);
  const { recoveryCode, deviceName } = await validateBody(request, recoverSchema);

  const linkCode = await prisma.linkCode.findUnique({
    where: { code: recoveryCode.toUpperCase() },
    select: { id: true, userId: true, expiresAt: true, consumedAt: true },
  });

  if (!linkCode || linkCode.consumedAt || linkCode.expiresAt <= new Date()) {
    notFound("No account found with that recovery code");
  }

  if (auth.device.revokedAt) {
    badRequest("Current device is not active");
  }

  const result = await mergeAccountIntoTarget({
    currentDeviceId: auth.deviceId,
    currentUserId: auth.userId,
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
