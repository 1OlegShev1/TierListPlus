import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { badRequest, notFound, validateBody, withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const renameDeviceSchema = z.object({
  displayName: z.string().trim().min(1).max(50),
});

export const DELETE = withHandler(async (request, { params }) => {
  const auth = await requireRequestAuth(request);
  const { deviceId } = await params;

  if (deviceId === auth.deviceId) {
    badRequest("Cannot revoke current device");
  }

  const device = await prisma.device.findFirst({
    where: {
      id: deviceId,
      userId: auth.userId,
      revokedAt: null,
    },
    select: { id: true },
  });

  if (!device) {
    notFound("Device not found");
  }

  await prisma.device.update({
    where: { id: deviceId },
    data: { revokedAt: new Date() },
  });

  return new Response(null, { status: 204 });
});

export const PATCH = withHandler(async (request, { params }) => {
  const auth = await requireRequestAuth(request);
  const { deviceId } = await params;
  const { displayName } = await validateBody(request, renameDeviceSchema);

  const { count } = await prisma.device.updateMany({
    where: {
      id: deviceId,
      userId: auth.userId,
      revokedAt: null,
    },
    data: { displayName },
  });

  if (count === 0) {
    notFound("Device not found");
  }

  return NextResponse.json({ id: deviceId, displayName });
});
