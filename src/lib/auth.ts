import type { Device, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseUserSessionToken,
  readUserSessionTokenFromCookieStore,
  readUserSessionTokenFromRequest,
} from "@/lib/user-session";

const LAST_SEEN_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export class RequestAuthError extends Error {
  constructor(
    public status: number,
    public details: string,
  ) {
    super(details);
  }
}

export interface RequestAuth {
  userId: string;
  deviceId: string;
  role: UserRole;
  device: Device;
}

async function touchDeviceIfStale(device: Device): Promise<Device> {
  if (Date.now() - device.lastSeenAt.getTime() < LAST_SEEN_TOUCH_INTERVAL_MS) {
    return device;
  }

  return prisma.device.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date() },
  });
}

async function resolveDeviceAuth(deviceId: string): Promise<RequestAuth | null> {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: {
      id: true,
      userId: true,
      displayName: true,
      createdAt: true,
      lastSeenAt: true,
      revokedAt: true,
      isMigrationSeed: true,
      user: {
        select: { role: true },
      },
    },
  });

  if (!device || device.revokedAt) {
    return null;
  }

  const { user, ...plainDevice } = device;
  const hydratedDevice = await touchDeviceIfStale(plainDevice);
  const role = user.role;

  return {
    userId: hydratedDevice.userId,
    deviceId: hydratedDevice.id,
    role,
    device: hydratedDevice,
  };
}

async function resolveLegacyUserAuth(userId: string): Promise<RequestAuth | null> {
  const device = await prisma.device.findFirst({
    where: {
      userId,
      isMigrationSeed: true,
      revokedAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      displayName: true,
      createdAt: true,
      lastSeenAt: true,
      revokedAt: true,
      isMigrationSeed: true,
      user: {
        select: { role: true },
      },
    },
  });

  if (!device) {
    return null;
  }

  const { user, ...plainDevice } = device;
  const hydratedDevice = await touchDeviceIfStale(plainDevice);
  const role: UserRole = user.role;

  return {
    userId: hydratedDevice.userId,
    deviceId: hydratedDevice.id,
    role,
    device: hydratedDevice,
  };
}

async function resolveSessionToken(token: string | null): Promise<RequestAuth | null> {
  if (!token) {
    return null;
  }

  const parsed = parseUserSessionToken(token);
  if (!parsed) {
    return null;
  }

  if (parsed.version === 2) {
    return resolveDeviceAuth(parsed.deviceId);
  }

  return resolveLegacyUserAuth(parsed.userId);
}

export function getRequestTokenVersion(request: Request): 1 | 2 | null {
  const token = readUserSessionTokenFromRequest(request);
  const parsed = token ? parseUserSessionToken(token) : null;
  return parsed?.version ?? null;
}

export function getCookieTokenVersion(cookieStore: {
  get(name: string): { value: string } | undefined;
}): 1 | 2 | null {
  const token = readUserSessionTokenFromCookieStore(cookieStore);
  const parsed = token ? parseUserSessionToken(token) : null;
  return parsed?.version ?? null;
}

export async function getRequestAuth(request: Request): Promise<RequestAuth | null> {
  return resolveSessionToken(readUserSessionTokenFromRequest(request));
}

export async function requireRequestAuth(request: Request): Promise<RequestAuth> {
  const auth = await getRequestAuth(request);
  if (!auth) {
    throw new RequestAuthError(401, "User identity required");
  }
  return auth;
}

export async function getCookieAuth(cookieStore: {
  get(name: string): { value: string } | undefined;
}): Promise<RequestAuth | null> {
  return resolveSessionToken(readUserSessionTokenFromCookieStore(cookieStore));
}
