import crypto from "node:crypto";

export const USER_SESSION_COOKIE = "tierlistplus_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export type UserSessionToken =
  | {
      userId: string;
      version: 1;
    }
  | {
      deviceId: string;
      version: 2;
    };

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET environment variable is required in production");
  }
  return "dev-only-session-secret-change-me";
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        if (idx < 0) return [part, ""];
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      }),
  );
}

export function createUserSessionToken(deviceId: string): string {
  const payload = { deviceId, v: 2 as const };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function parseUserSessionToken(token: string): UserSessionToken | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = sign(encodedPayload);
  if (signature.length !== expected.length) return null;

  const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!isValid) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      deviceId?: unknown;
      userId?: unknown;
      v?: unknown;
    };
    if (parsed.v === 1) {
      if (typeof parsed.userId !== "string" || parsed.userId.length === 0) return null;
      return { userId: parsed.userId, version: 1 };
    }
    if (parsed.v === 2) {
      if (typeof parsed.deviceId !== "string" || parsed.deviceId.length === 0) return null;
      return { deviceId: parsed.deviceId, version: 2 };
    }
    return null;
  } catch {
    return null;
  }
}

export function readUserSessionTokenFromCookieHeader(cookieHeader: string | null): string | null {
  const cookies = parseCookieHeader(cookieHeader);
  return cookies[USER_SESSION_COOKIE] ?? null;
}

export function readUserSessionTokenFromRequest(request: Request): string | null {
  return readUserSessionTokenFromCookieHeader(request.headers.get("cookie"));
}

export function readUserSessionTokenFromCookieStore(cookieStore: {
  get(name: string): { value: string } | undefined;
}): string | null {
  return cookieStore.get(USER_SESSION_COOKIE)?.value ?? null;
}

export function getUserSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

export function getClearedUserSessionCookieOptions() {
  return {
    ...getUserSessionCookieOptions(),
    maxAge: 0,
  };
}
