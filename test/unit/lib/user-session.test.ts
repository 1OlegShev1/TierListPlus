import {
  createUserSessionToken,
  getClearedUserSessionCookieOptions,
  getUserSessionCookieOptions,
  parseUserSessionToken,
  readUserSessionTokenFromCookieHeader,
  readUserSessionTokenFromRequest,
  USER_SESSION_COOKIE,
} from "@/lib/user-session";

describe("user-session", () => {
  it("creates and parses a signed v2 token", () => {
    const token = createUserSessionToken("device_123");
    expect(token).toContain(".");
    expect(parseUserSessionToken(token)).toEqual({ deviceId: "device_123", version: 2 });
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
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;

    const modulePath = "@/lib/user-session";
    vi.resetModules();
    const reloaded = await import(modulePath);

    expect(() => reloaded.createUserSessionToken("device_123")).toThrow(
      "SESSION_SECRET environment variable is required in production",
    );
  });
});
