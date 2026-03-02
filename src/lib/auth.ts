import type { Device } from "@prisma/client";
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
  });

  if (!device || device.revokedAt) {
    return null;
  }

  const hydratedDevice = await touchDeviceIfStale(device);

  return {
    userId: hydratedDevice.userId,
    deviceId: hydratedDevice.id,
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
  });

  if (!device) {
    return null;
  }

  const hydratedDevice = await touchDeviceIfStale(device);

  return {
    userId: hydratedDevice.userId,
    deviceId: hydratedDevice.id,
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
