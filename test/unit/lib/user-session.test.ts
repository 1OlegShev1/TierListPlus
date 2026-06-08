import crypto from "node:crypto";
import {
  createUserSessionToken,
  getClearedUserSessionCookieOptions,
  getUserSessionCookieOptions,
  parseUserSessionToken,
  readUserSessionTokenFromCookieHeader,
  readUserSessionTokenFromRequest,
  shouldRefreshUserSessionToken,
  USER_SESSION_COOKIE,
} from "@/lib/user-session";

function createSignedTestToken(payload: unknown, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

describe("user-session", () => {
  it("creates and parses a signed v2 token", () => {
    const token = createUserSessionToken("device_123");
    expect(token).toContain(".");
    expect(parseUserSessionToken(token)).toEqual({ deviceId: "device_123", version: 2 });
    expect(shouldRefreshUserSessionToken(token)).toBe(false);
  });

  it("accepts tokens signed with the previous secret and marks them for refresh", () => {
    vi.stubEnv("SESSION_SECRET", "current-secret");
    vi.stubEnv("SESSION_SECRET_PREVIOUS", "previous-secret");

    const token = createSignedTestToken({ deviceId: "device_123", v: 2 }, "previous-secret");

    expect(parseUserSessionToken(token)).toEqual({ deviceId: "device_123", version: 2 });
    expect(shouldRefreshUserSessionToken(token)).toBe(true);
  });

  it("marks legacy v1 tokens for refresh", () => {
    vi.stubEnv("SESSION_SECRET", "current-secret");
    const token = createSignedTestToken({ userId: "user_123", v: 1 }, "current-secret");

    expect(parseUserSessionToken(token)).toEqual({ userId: "user_123", version: 1 });
    expect(shouldRefreshUserSessionToken(token)).toBe(true);
  });

  it("returns null for malformed, invalid, or unsupported tokens", () => {
    const token = createUserSessionToken("device_123");
    const [payload] = token.split(".");
    const unsupported = `${Buffer.from(JSON.stringify({ v: 99 })).toString("base64url")}.sig`;

    expect(parseUserSessionToken(`${payload}.bad-signature`)).toBeNull();
    expect(parseUserSessionToken("not-a-token")).toBeNull();
    expect(parseUserSessionToken(`${Buffer.from("{").toString("base64url")}.sig`)).toBeNull();
    expect(parseUserSessionToken(unsupported)).toBeNull();
  });

  it("reads cookies and exposes cookie options", () => {
    const token = createUserSessionToken("device_123");
    const header = `foo=1; ${USER_SESSION_COOKIE}=${encodeURIComponent(token)}; bar=2`;
    const request = new Request("https://example.test", { headers: { cookie: header } });

    expect(readUserSessionTokenFromCookieHeader(header)).toBe(token);
    expect(readUserSessionTokenFromRequest(request)).toBe(token);

    expect(getUserSessionCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      maxAge: 31536000,
    });
    expect(getClearedUserSessionCookieOptions()).toMatchObject({ maxAge: 0 });
  });

  it("throws in production when no session secret is present", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");

    try {
      const modulePath = "@/lib/user-session";
      vi.resetModules();
      const reloaded = await import(modulePath);

      expect(() => reloaded.createUserSessionToken("device_123")).toThrow(
        "SESSION_SECRET environment variable is required in production",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
