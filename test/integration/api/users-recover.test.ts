const mocks = vi.hoisted(() => ({
  prisma: {
    linkCode: {
      findUnique: vi.fn(),
    },
  },
  getRequestAuth: vi.fn(),
  mergeAccountIntoTarget: vi.fn(),
  linkDeviceToTarget: vi.fn(),
  takeRateLimitToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  getRequestAuth: mocks.getRequestAuth,
}));
vi.mock("@/lib/account-linking", () => ({
  mergeAccountIntoTarget: mocks.mergeAccountIntoTarget,
  linkDeviceToTarget: mocks.linkDeviceToTarget,
}));
vi.mock("@/lib/rate-limit", () => ({
  takeRateLimitToken: mocks.takeRateLimitToken,
}));

import { POST } from "@/app/api/users/recover/route";
import { jsonRequest } from "../../helpers/request";

describe("users recover route", () => {
  const now = Date.now();

  beforeEach(() => {
    mocks.prisma.linkCode.findUnique.mockReset();
    mocks.getRequestAuth.mockReset().mockResolvedValue({
      userId: "user_1",
      deviceId: "device_1",
      device: {
        revokedAt: null,
      },
    });
    mocks.mergeAccountIntoTarget.mockReset().mockResolvedValue({
      userId: "user_2",
      deviceId: "device_9",
    });
    mocks.linkDeviceToTarget.mockReset().mockResolvedValue({
      userId: "user_2",
      deviceId: "device_new",
    });
    mocks.takeRateLimitToken.mockReset().mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("rate-limits recovery attempts per device", async () => {
    mocks.takeRateLimitToken.mockReturnValue({
      allowed: false,
      retryAfterSeconds: 30,
    });

    const response = await POST(
      jsonRequest("POST", "https://example.test", {
        recoveryCode: "abc123",
        deviceName: "Phone",
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    await expect(response.json()).resolves.toEqual({
      error: "Too many recovery attempts. Please wait and try again.",
    });
    expect(mocks.takeRateLimitToken).toHaveBeenCalledWith({
      key: "recover:device:device_1",
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
    });
    expect(mocks.prisma.linkCode.findUnique).not.toHaveBeenCalled();
    expect(mocks.mergeAccountIntoTarget).not.toHaveBeenCalled();
  });

  it("returns not found for missing or expired recovery codes", async () => {
    let response = await POST(
      jsonRequest("POST", "https://example.test", {
        recoveryCode: "abc123",
        deviceName: "Phone",
      }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "No account found with that recovery code",
    });

    mocks.prisma.linkCode.findUnique.mockResolvedValue({
      id: "link_1",
      userId: "user_2",
      expiresAt: new Date(now - 86_400_000),
      consumedAt: null,
    });
    response = await POST(
      jsonRequest("POST", "https://example.test", {
        recoveryCode: "abc123",
        deviceName: "Phone",
      }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(404);
  });

  it("merges an authenticated account into the link-code owner", async () => {
    mocks.prisma.linkCode.findUnique.mockResolvedValue({
      id: "link_1",
      userId: "user_2",
      expiresAt: new Date(now + 86_400_000),
      consumedAt: null,
    });
    const response = await POST(
      jsonRequest("POST", "https://example.test", {
        recoveryCode: "abc123",
        deviceName: "Phone",
      }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ userId: "user_2", deviceId: "device_9" });
    expect(mocks.mergeAccountIntoTarget).toHaveBeenCalledWith({
      currentDeviceId: "device_1",
      currentUserId: "user_1",
      targetUserId: "user_2",
      deviceName: "Phone",
      linkCodeId: "link_1",
    });
    expect(mocks.linkDeviceToTarget).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain("tierlistplus_session=");
  });

  it("links an unauthenticated browser directly without creating a temporary user", async () => {
    mocks.getRequestAuth.mockResolvedValue(null);
    mocks.prisma.linkCode.findUnique.mockResolvedValue({
      id: "link_1",
      userId: "user_2",
      expiresAt: new Date(now + 86_400_000),
      consumedAt: null,
    });

    const response = await POST(
      jsonRequest(
        "POST",
        "https://example.test",
        { recoveryCode: "abc123", deviceName: "Restored Chrome" },
        { "x-forwarded-for": "203.0.113.9" },
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      userId: "user_2",
      deviceId: "device_new",
    });
    expect(mocks.linkDeviceToTarget).toHaveBeenCalledWith({
      targetUserId: "user_2",
      deviceName: "Restored Chrome",
      linkCodeId: "link_1",
    });
    expect(mocks.mergeAccountIntoTarget).not.toHaveBeenCalled();
    expect(mocks.takeRateLimitToken).toHaveBeenCalledWith({
      key: "recover-anonymous:ip:203.0.113.9",
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
    });
    expect(response.headers.get("set-cookie")).toContain("tierlistplus_session=");
  });
});
