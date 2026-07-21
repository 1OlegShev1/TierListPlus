const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
  },
  getRequestAuthResult: vi.fn(),
  shouldRefreshRequestSessionToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  getRequestAuthResult: mocks.getRequestAuthResult,
  shouldRefreshRequestSessionToken: mocks.shouldRefreshRequestSessionToken,
}));

import { POST as createUser } from "@/app/api/users/route";
import { GET as getSession } from "@/app/api/users/session/route";
import { makeDevice, makeUser } from "../../helpers/mocks";

describe("user routes", () => {
  beforeEach(() => {
    mocks.prisma.$transaction.mockReset();
    mocks.getRequestAuthResult.mockReset();
    mocks.shouldRefreshRequestSessionToken.mockReset().mockReturnValue(false);
  });

  it("creates a user and sets the session cookie", async () => {
    mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        user: { create: vi.fn().mockResolvedValue(makeUser()) },
        device: { create: vi.fn().mockResolvedValue(makeDevice()) },
        identityEvent: { create: vi.fn().mockResolvedValue({}) },
      }),
    );

    const response = await createUser(new Request("https://example.test"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: "user_1",
      userId: "user_1",
      deviceId: "device_1",
    });
    expect(response.headers.get("set-cookie")).toContain("tierlistplus_session=");
  });

  it("returns 401 for missing auth and refreshes stale session tokens", async () => {
    mocks.getRequestAuthResult.mockResolvedValue({
      ok: false,
      code: "SESSION_COOKIE_MISSING",
    });

    let response = await getSession(new Request("https://example.test"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "User identity required",
      code: "SESSION_COOKIE_MISSING",
    });

    mocks.shouldRefreshRequestSessionToken.mockReturnValue(true);
    mocks.getRequestAuthResult.mockResolvedValue({
      ok: true,
      auth: {
        userId: "user_1",
        deviceId: "device_1",
        role: "USER",
        device: makeDevice(),
      },
    });
    response = await getSession(new Request("https://example.test"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "user_1",
      userId: "user_1",
      deviceId: "device_1",
      deviceName: "Device 1",
      role: "USER",
    });
    expect(response.headers.get("set-cookie")).toContain("tierlistplus_session=");
  });
});
