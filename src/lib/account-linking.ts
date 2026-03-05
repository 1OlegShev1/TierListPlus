import type { Participant } from "@prisma/client";
import { pickParticipantSurvivor } from "@/lib/account-linking-helpers";
import { prisma } from "@/lib/prisma";

export const LINK_CODE_TTL_MS = 15 * 60 * 1000;

function fail(status: number, details: string): never {
  const error = new Error(details) as Error & { status: number; details: string };
  error.status = status;
  error.details = details;
  throw error;
}

export async function mergeAccountIntoTarget(options: {
  currentDeviceId: string;
  currentUserId: string;
  targetUserId: string;
  deviceName: string;
  linkCodeId: string;
}) {
  const { currentDeviceId, currentUserId, targetUserId, deviceName, linkCodeId } = options;

  return prisma.$transaction(async (tx) => {
    const [linkCode, currentDevice, sourceUser, targetUser] = await Promise.all([
      tx.linkCode.findUnique({ where: { id: linkCodeId } }),
      tx.device.findUnique({ where: { id: currentDeviceId } }),
      tx.user.findUnique({ where: { id: currentUserId } }),
      tx.user.findUnique({ where: { id: targetUserId } }),
    ]);

    const now = new Date();

    if (
      !linkCode ||
      linkCode.userId !== targetUserId ||
      linkCode.consumedAt ||
      linkCode.expiresAt <= now
    ) {
      fail(400, "Link code is invalid or expired");
    }

    if (!currentDevice || currentDevice.revokedAt || currentDevice.userId !== currentUserId) {
      fail(400, "Current device is no longer available");
    }

    if (!sourceUser || !targetUser) {
      fail(404, "User not found");
    }

    if (currentUserId === targetUserId) {
      const renamedDevice = await tx.device.update({
        where: { id: currentDeviceId },
        data: { displayName: deviceName },
      });

      await tx.linkCode.update({
        where: { id: linkCodeId },
        data: { consumedAt: now },
      });

      return {
        userId: targetUserId,
        deviceId: renamedDevice.id,
      };
    }

    await tx.template.updateMany({
      where: { creatorId: currentUserId },
      data: { creatorId: targetUserId },
    });

    await tx.session.updateMany({
      where: { creatorId: currentUserId },
      data: { creatorId: targetUserId },
    });

    await tx.space.updateMany({
      where: { creatorId: currentUserId },
      data: { creatorId: targetUserId },
    });

    await tx.spaceInvite.updateMany({
      where: { createdByUserId: currentUserId },
      data: { createdByUserId: targetUserId },
    });

    const spaceMemberships = await tx.spaceMember.findMany({
      where: { userId: { in: [currentUserId, targetUserId] } },
      orderBy: [{ spaceId: "asc" }, { createdAt: "asc" }],
    });
    const membershipsBySpace = new Map<string, typeof spaceMemberships>();
    for (const membership of spaceMemberships) {
      const bucket = membershipsBySpace.get(membership.spaceId) ?? [];
      bucket.push(membership);
      membershipsBySpace.set(membership.spaceId, bucket);
    }
    for (const memberships of membershipsBySpace.values()) {
      const targetMembership = memberships.find((membership) => membership.userId === targetUserId);
      const survivor = targetMembership ?? memberships[0];
      const hasOwner = memberships.some((membership) => membership.role === "OWNER");

      if (survivor.userId !== targetUserId) {
        await tx.spaceMember.update({
          where: { id: survivor.id },
          data: { userId: targetUserId },
        });
      }
      if (hasOwner && survivor.role !== "OWNER") {
        await tx.spaceMember.update({
          where: { id: survivor.id },
          data: { role: "OWNER" },
        });
      }

      const duplicateIds = memberships
        .filter((membership) => membership.id !== survivor.id)
        .map((membership) => membership.id);
      if (duplicateIds.length > 0) {
        await tx.spaceMember.deleteMany({
          where: { id: { in: duplicateIds } },
        });
      }
    }

    const participants = await tx.participant.findMany({
      where: { userId: { in: [currentUserId, targetUserId] } },
      orderBy: [{ sessionId: "asc" }, { createdAt: "asc" }],
    });

    const participantsBySession = new Map<string, Participant[]>();
    for (const participant of participants) {
      const bucket = participantsBySession.get(participant.sessionId) ?? [];
      bucket.push(participant);
      participantsBySession.set(participant.sessionId, bucket);
    }

    for (const sessionParticipants of participantsBySession.values()) {
      const survivor = pickParticipantSurvivor(sessionParticipants, targetUserId);
      if (survivor.userId !== targetUserId) {
        await tx.participant.update({
          where: { id: survivor.id },
          data: { userId: targetUserId },
        });
      }

      const duplicateIds = sessionParticipants
        .filter((participant) => participant.id !== survivor.id)
        .map((participant) => participant.id);

      if (duplicateIds.length > 0) {
        await tx.participant.deleteMany({
          where: { id: { in: duplicateIds } },
        });
      }
    }

    await tx.device.updateMany({
      where: { userId: currentUserId },
      data: { userId: targetUserId },
    });

    await tx.linkCode.deleteMany({
      where: {
        userId: { in: [currentUserId, targetUserId] },
        consumedAt: null,
        id: { not: linkCodeId },
      },
    });

    const renamedDevice = await tx.device.update({
      where: { id: currentDeviceId },
      data: { displayName: deviceName },
    });

    await tx.linkCode.update({
      where: { id: linkCodeId },
      data: { consumedAt: now },
    });

    await tx.user.delete({
      where: { id: currentUserId },
    });

    return {
      userId: targetUserId,
      deviceId: renamedDevice.id,
    };
  });
}

export async function findActiveLinkCode(userId: string) {
  return prisma.linkCode.findFirst({
    where: {
      userId,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}
