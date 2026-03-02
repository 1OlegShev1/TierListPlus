import { NextResponse } from "next/server";
import { withHandler } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import {
  createUserSessionToken,
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE,
} from "@/lib/user-session";

export const POST = withHandler(async () => {
  const { user, device } = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({ data: {} });
    const createdDevice = await tx.device.create({
      data: {
        userId: createdUser.id,
        displayName: "Device 1",
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
