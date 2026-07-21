import type { Device, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseUserSessionToken,
  readUserSessionTokenFromCookieStore,
  readUserSessionTokenFromRequest,
  shouldRefreshUserSessionToken,
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

export type AuthFailureCode =
  | "SESSION_COOKIE_MISSING"
  | "SESSION_TOKEN_INVALID"
  | "SESSION_DEVICE_NOT_FOUND"
  | "SESSION_DEVICE_REVOKED";

export type RequestAuthResult =
  | { ok: true; auth: RequestAuth }
  | { ok: false; code: AuthFailureCode };

async function touchDeviceIfStale(device: Device): Promise<Device> {
  if (Date.now() - device.lastSeenAt.getTime() < LAST_SEEN_TOUCH_INTERVAL_MS) {
    return device;
  }

  return prisma.device.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date() },
  });
}

async function resolveDeviceAuth(deviceId: string): Promise<RequestAuthResult> {
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

  if (!device) return { ok: false, code: "SESSION_DEVICE_NOT_FOUND" };
  if (device.revokedAt) return { ok: false, code: "SESSION_DEVICE_REVOKED" };

  const { user, ...plainDevice } = device;
  const hydratedDevice = await touchDeviceIfStale(plainDevice);
  const role = user.role;

  return {
    ok: true,
    auth: {
      userId: hydratedDevice.userId,
      deviceId: hydratedDevice.id,
      role,
      device: hydratedDevice,
    },
  };
}

async function resolveLegacyUserAuth(userId: string): Promise<RequestAuthResult> {
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
    const revokedDevice = await prisma.device.findFirst({
      where: { userId, isMigrationSeed: true },
      select: { id: true },
    });
    return revokedDevice
      ? { ok: false, code: "SESSION_DEVICE_REVOKED" }
      : { ok: false, code: "SESSION_DEVICE_NOT_FOUND" };
  }

  const { user, ...plainDevice } = device;
  const hydratedDevice = await touchDeviceIfStale(plainDevice);
  const role: UserRole = user.role;

  return {
    ok: true,
    auth: {
      userId: hydratedDevice.userId,
      deviceId: hydratedDevice.id,
      role,
      device: hydratedDevice,
    },
  };
}

async function resolveSessionToken(token: string | null): Promise<RequestAuthResult> {
  if (!token) {
    return { ok: false, code: "SESSION_COOKIE_MISSING" };
  }

  const parsed = parseUserSessionToken(token);
  if (!parsed) {
    return { ok: false, code: "SESSION_TOKEN_INVALID" };
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

export function shouldRefreshRequestSessionToken(request: Request): boolean {
  const token = readUserSessionTokenFromRequest(request);
  return token ? shouldRefreshUserSessionToken(token) : false;
}

export function getCookieTokenVersion(cookieStore: {
  get(name: string): { value: string } | undefined;
}): 1 | 2 | null {
  const token = readUserSessionTokenFromCookieStore(cookieStore);
  const parsed = token ? parseUserSessionToken(token) : null;
  return parsed?.version ?? null;
}

export async function getRequestAuth(request: Request): Promise<RequestAuth | null> {
  const result = await getRequestAuthResult(request);
  return result.ok ? result.auth : null;
}

export async function getRequestAuthResult(request: Request): Promise<RequestAuthResult> {
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
  const result = await resolveSessionToken(readUserSessionTokenFromCookieStore(cookieStore));
  return result.ok ? result.auth : null;
}
