import { NextResponse } from "next/server";
import { withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { takeRateLimitToken } from "@/lib/rate-limit";
import { getRequestClientKey } from "@/lib/request-client-key";
import {
  createUserSessionToken,
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE,
} from "@/lib/user-session";

const USER_CREATE_RATE_LIMIT_MAX_REQUESTS = 30;
const USER_CREATE_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

type UserCreationReason = "FIRST_VISIT" | "EXPLICIT_FRESH_START";

async function readCreationReason(request: Request): Promise<UserCreationReason> {
  try {
    const body = (await request.json()) as { reason?: unknown };
    return body.reason === "EXPLICIT_FRESH_START" ? "EXPLICIT_FRESH_START" : "FIRST_VISIT";
  } catch {
    return "FIRST_VISIT";
  }
}

export const POST = withHandler(async (request) => {
  const rateLimit = takeRateLimitToken({
    key: getRequestClientKey(request, "user-create"),
    maxRequests: USER_CREATE_RATE_LIMIT_MAX_REQUESTS,
    windowMs: USER_CREATE_RATE_LIMIT_WINDOW_MS,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many identity creation attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const creationReason = await readCreationReason(request);
  const { user, device } = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({ data: {} });
    const createdDevice = await tx.device.create({
      data: {
        userId: createdUser.id,
        displayName: "Device 1",
      },
    });

    await tx.identityEvent.create({
      data: {
        type: "USER_CREATED",
        userId: createdUser.id,
        deviceId: createdDevice.id,
        reason: creationReason,
      },
    });

    return { user: createdUser, device: createdDevice };
  });

  const res = NextResponse.json(
    { id: user.id, userId: user.id, deviceId: device.id },
    { status: 201 },
  );
  res.cookies.set(
    USER_SESSION_COOKIE,
    createUserSessionToken(device.id),
    getUserSessionCookieOptions(),
  );
  return res;
});
