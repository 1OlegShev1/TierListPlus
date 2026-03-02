const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    linkCode: {
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
  requireRequestAuth: vi.fn(),
  generateRecoveryCode: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  requireRequestAuth: mocks.requireRequestAuth,
}));
vi.mock("@/lib/account-linking", () => ({
  LINK_CODE_TTL_MS: 15 * 60 * 1000,
}));
vi.mock("@/lib/recovery-code", () => ({
  generateRecoveryCode: mocks.generateRecoveryCode,
}));

import { POST } from "@/app/api/users/[userId]/recovery/route";
import { routeCtx } from "../../helpers/request";

describe("user recovery code route", () => {
  beforeEach(() => {
    mocks.prisma.user.findUnique.mockReset();
    mocks.prisma.linkCode.deleteMany.mockReset();
    mocks.prisma.linkCode.findUnique.mockReset();
    mocks.prisma.linkCode.create.mockReset();
    mocks.requireRequestAuth.mockReset().mockResolvedValue({ userId: "user_1" });
    mocks.generateRecoveryCode.mockReset().mockReturnValue("CODE1");
  });

  it("requires ownership and an existing user", async () => {
    mocks.requireRequestAuth.mockResolvedValueOnce({ userId: "user_2" });

    let response = await POST(new Request("https://example.test", { method: "POST" }), routeCtx({ userId: "user_1" }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "You are not the owner of this resource",
    });

    mocks.prisma.user.findUnique.mockResolvedValue(null);
    response = await POST(new Request("https://example.test", { method: "POST" }), routeCtx({ userId: "user_1" }));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "User not found" });
  });

  it("retries duplicate codes and creates a fresh active recovery code", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "user_1" });
    mocks.generateRecoveryCode.mockReturnValueOnce("CODE1").mockReturnValueOnce("CODE2");
    mocks.prisma.linkCode.findUnique
      .mockResolvedValueOnce({ id: "existing" })
      .mockResolvedValueOnce(null);

    const response = await POST(
      new Request("https://example.test", { method: "POST" }),
      routeCtx({ userId: "user_1" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      linkCode: "CODE2",
      expiresAt: expect.any(String),
    });
    expect(mocks.prisma.linkCode.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        consumedAt: null,
      },
    });
    expect(mocks.prisma.linkCode.create).toHaveBeenCalledWith({
      data: {
        userId: "user_1",
        code: "CODE2",
        expiresAt: expect.any(Date),
      },
    });
  });
});
