import { NextResponse } from "next/server";
import { withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const GET = withHandler(async (request) => {
  const auth = await requireRequestAuth(request);
  const now = new Date();

  const [devices, activeLinkCode] = await Promise.all([
    prisma.device.findMany({
      where: {
        userId: auth.userId,
        revokedAt: null,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.linkCode.findFirst({
      where: {
        userId: auth.userId,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    currentDeviceId: auth.deviceId,
    devices: devices.map((device) => ({
      id: device.id,
      displayName: device.displayName,
      createdAt: device.createdAt,
      lastSeenAt: device.lastSeenAt,
      revokedAt: device.revokedAt,
      isCurrent: device.id === auth.deviceId,
    })),
    activeLinkCode: activeLinkCode
      ? {
          linkCode: activeLinkCode.code,
          expiresAt: activeLinkCode.expiresAt,
        }
      : null,
  });
});
