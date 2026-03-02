import { badRequest, notFound, withHandler } from "@/lib/api-helpers";
import { requireRequestAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
