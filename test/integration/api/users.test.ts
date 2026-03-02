const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
  },
  getRequestAuth: vi.fn(),
  getRequestTokenVersion: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  getRequestAuth: mocks.getRequestAuth,
  getRequestTokenVersion: mocks.getRequestTokenVersion,
}));

import { POST as createUser } from "@/app/api/users/route";
import { GET as getSession } from "@/app/api/users/session/route";
import { makeDevice, makeUser } from "../../helpers/mocks";

describe("user routes", () => {
  beforeEach(() => {
    mocks.prisma.$transaction.mockReset();
    mocks.getRequestAuth.mockReset();
    mocks.getRequestTokenVersion.mockReset();
  });

  it("creates a user and sets the session cookie", async () => {
    mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        user: { create: vi.fn().mockResolvedValue(makeUser()) },
        device: { create: vi.fn().mockResolvedValue(makeDevice()) },
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

  it("returns 401 for missing auth and refreshes v1 tokens", async () => {
    mocks.getRequestTokenVersion.mockReturnValue(null);
    mocks.getRequestAuth.mockResolvedValue(null);

    let response = await getSession(new Request("https://example.test"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "User identity required" });

    mocks.getRequestTokenVersion.mockReturnValue(1);
    mocks.getRequestAuth.mockResolvedValue({
      userId: "user_1",
      deviceId: "device_1",
      device: makeDevice(),
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
    });
    expect(response.headers.get("set-cookie")).toContain("tierlistplus_session=");
  });
});
