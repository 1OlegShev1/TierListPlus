const mocks = vi.hoisted(() => ({
  prisma: {
    device: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  requireRequestAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  requireRequestAuth: mocks.requireRequestAuth,
}));

import { DELETE, PATCH } from "@/app/api/users/devices/[deviceId]/route";
import { jsonRequest, routeCtx } from "../../helpers/request";

describe("device delete route", () => {
  beforeEach(() => {
    mocks.prisma.device.findFirst.mockReset();
    mocks.prisma.device.update.mockReset();
    mocks.prisma.device.updateMany.mockReset();
    mocks.requireRequestAuth.mockReset().mockResolvedValue({
      userId: "user_1",
      deviceId: "device_1",
    });
  });

  it("renames an owned active device", async () => {
    mocks.prisma.device.updateMany.mockResolvedValue({ count: 1 });

    const response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { displayName: "  Work Chrome  " }),
      routeCtx({ deviceId: "device_2" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "device_2",
      displayName: "Work Chrome",
    });
    expect(mocks.prisma.device.updateMany).toHaveBeenCalledWith({
      where: {
        id: "device_2",
        userId: "user_1",
        revokedAt: null,
      },
      data: { displayName: "Work Chrome" },
    });
  });

  it("rejects invalid rename payload and missing devices", async () => {
    let response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { displayName: "   " }),
      routeCtx({ deviceId: "device_2" }),
    );
    expect(response.status).toBe(400);
    expect(mocks.prisma.device.updateMany).not.toHaveBeenCalled();

    mocks.prisma.device.updateMany.mockResolvedValue({ count: 0 });
    response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { displayName: "Phone" }),
      routeCtx({ deviceId: "device_2" }),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Device not found" });
  });

  it("rejects revoking the current device and missing devices", async () => {
    let response = await DELETE(new Request("https://example.test"), routeCtx({ deviceId: "device_1" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Cannot revoke current device" });

    mocks.prisma.device.findFirst.mockResolvedValue(null);
    response = await DELETE(new Request("https://example.test"), routeCtx({ deviceId: "device_2" }));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Device not found" });
  });

  it("revokes an owned active device", async () => {
    mocks.prisma.device.findFirst.mockResolvedValue({ id: "device_2" });

    const response = await DELETE(new Request("https://example.test"), routeCtx({ deviceId: "device_2" }));

    expect(response.status).toBe(204);
    expect(mocks.prisma.device.update).toHaveBeenCalledWith({
      where: { id: "device_2" },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
