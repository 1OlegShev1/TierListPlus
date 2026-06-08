const mocks = vi.hoisted(() => ({
  prisma: {
    linkCode: {
      findUnique: vi.fn(),
    },
  },
  requireRequestAuth: vi.fn(),
  mergeAccountIntoTarget: vi.fn(),
  takeRateLimitToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  requireRequestAuth: mocks.requireRequestAuth,
}));
vi.mock("@/lib/account-linking", () => ({
  mergeAccountIntoTarget: mocks.mergeAccountIntoTarget,
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
    mocks.requireRequestAuth.mockReset().mockResolvedValue({
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
      key: "recover:device_1",
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

  it("rejects revoked devices and merges accounts on success", async () => {
    mocks.prisma.linkCode.findUnique.mockResolvedValue({
      id: "link_1",
      userId: "user_2",
      expiresAt: new Date(now + 86_400_000),
      consumedAt: null,
    });
    mocks.requireRequestAuth.mockResolvedValueOnce({
      userId: "user_1",
      deviceId: "device_1",
      device: {
        revokedAt: new Date("2026-03-02T00:00:00.000Z"),
      },
    });

    let response = await POST(
      jsonRequest("POST", "https://example.test", {
        recoveryCode: "abc123",
        deviceName: "Phone",
      }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Current device is not active" });

    mocks.requireRequestAuth.mockResolvedValue({
      userId: "user_1",
      deviceId: "device_1",
      device: {
        revokedAt: null,
      },
    });
    response = await POST(
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
    expect(response.headers.get("set-cookie")).toContain("tierlistplus_session=");
  });
});
