const mocks = vi.hoisted(() => ({
  prisma: {
    device: {
      findMany: vi.fn(),
    },
    linkCode: {
      findFirst: vi.fn(),
    },
  },
  requireRequestAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  requireRequestAuth: mocks.requireRequestAuth,
}));

import { GET } from "@/app/api/users/devices/route";
import { makeDevice } from "../../helpers/mocks";

describe("devices route", () => {
  beforeEach(() => {
    mocks.prisma.device.findMany.mockReset();
    mocks.prisma.linkCode.findFirst.mockReset();
    mocks.requireRequestAuth.mockReset().mockResolvedValue({
      userId: "user_1",
      deviceId: "device_1",
    });
  });

  it("returns devices with current device flag and active link code", async () => {
    mocks.prisma.device.findMany.mockResolvedValue([
      makeDevice(),
      makeDevice({ id: "device_2", displayName: "Device 2" }),
    ]);
    mocks.prisma.linkCode.findFirst.mockResolvedValue({
      code: "LINKME",
      expiresAt: new Date("2026-03-02T13:00:00.000Z"),
    });

    const response = await GET(new Request("https://example.test"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      currentDeviceId: "device_1",
      devices: [
        expect.objectContaining({ id: "device_1", isCurrent: true }),
        expect.objectContaining({ id: "device_2", isCurrent: false }),
      ],
      activeLinkCode: {
        linkCode: "LINKME",
        expiresAt: new Date("2026-03-02T13:00:00.000Z").toISOString(),
      },
    });
  });
});
