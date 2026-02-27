import crypto from "node:crypto";

export const USER_SESSION_COOKIE = "tierlistplus_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

interface SessionPayload {
  userId: string;
  v: 1;
}

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

export function createUserSessionToken(userId: string): string {
  const payload: SessionPayload = { userId, v: 1 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyUserSessionToken(token: string): string | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = sign(encodedPayload);
  if (signature.length !== expected.length) return null;

  const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!isValid) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      userId?: unknown;
      v?: unknown;
    };
    if (parsed.v !== 1) return null;
    if (typeof parsed.userId !== "string" || parsed.userId.length === 0) return null;
    return parsed.userId;
  } catch {
    return null;
  }
}

export function getUserIdFromSessionCookie(request: Request): string | null {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const token = cookies[USER_SESSION_COOKIE];
  if (!token) return null;
  return verifyUserSessionToken(token);
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
