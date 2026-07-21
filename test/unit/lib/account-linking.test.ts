const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

import { linkDeviceToTarget, mergeAccountIntoTarget } from "@/lib/account-linking";

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: "draft_1",
    userId: "source",
    deviceId: null,
    kind: "LIST_EDITOR",
    scope: "template:1",
    payload: {},
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("mergeAccountIntoTarget", () => {
  beforeEach(() => {
    mocks.prisma.$transaction.mockReset();
  });

  it("preserves the newest draft per kind and scope when merging users", async () => {
    const tx = {
      linkCode: {
        findUnique: vi.fn().mockResolvedValue({
          id: "link_1",
          userId: "target",
          expiresAt: new Date(Date.now() + 60_000),
          consumedAt: null,
        }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
      device: {
        findUnique: vi.fn().mockResolvedValue({
          id: "device_1",
          userId: "source",
          displayName: "Old name",
          revokedAt: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({ id: "device_1" }),
      },
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: "source", role: "ADMIN", nickname: "Source Admin" })
          .mockResolvedValueOnce({ id: "target", role: "USER", nickname: null }),
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({}),
      },
      identityEvent: { create: vi.fn().mockResolvedValue({}) },
      template: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      session: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      space: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      spaceInvite: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      spaceMember: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      participant: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      draft: {
        findMany: vi.fn().mockResolvedValue([
          makeDraft({
            id: "target_old",
            userId: "target",
            updatedAt: new Date("2026-03-01T00:00:00.000Z"),
          }),
          makeDraft({
            id: "source_new",
            userId: "source",
            updatedAt: new Date("2026-03-02T00:00:00.000Z"),
          }),
          makeDraft({
            id: "source_only",
            userId: "source",
            kind: "VOTE_BOARD",
            scope: "session:1",
            updatedAt: new Date("2026-03-01T00:00:00.000Z"),
          }),
        ]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    mocks.prisma.$transaction.mockImplementation((fn) => fn(tx));

    await expect(
      mergeAccountIntoTarget({
        currentDeviceId: "device_1",
        currentUserId: "source",
        targetUserId: "target",
        deviceName: "Phone",
        linkCodeId: "link_1",
      }),
    ).resolves.toEqual({ userId: "target", deviceId: "device_1" });

    expect(tx.draft.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["target_old"] } },
    });
    expect(tx.draft.update).toHaveBeenCalledWith({
      where: { id: "source_new" },
      data: { userId: "target" },
    });
    expect(tx.draft.update).toHaveBeenCalledWith({
      where: { id: "source_only" },
      data: { userId: "target" },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "source" } });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "target" },
      data: { role: "ADMIN", nickname: "Source Admin" },
    });
    expect(tx.identityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "ACCOUNT_MERGED",
        userId: "target",
        relatedUserId: "source",
        metadata: expect.objectContaining({ survivingRole: "ADMIN" }),
      }),
    });
  });

  it("links a browser directly to the target when no source session exists", async () => {
    const tx = {
      linkCode: {
        findUnique: vi.fn().mockResolvedValue({
          id: "link_1",
          userId: "target",
          expiresAt: new Date(Date.now() + 60_000),
          consumedAt: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "target" }),
      },
      device: {
        create: vi.fn().mockResolvedValue({ id: "device_new" }),
      },
      identityEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    mocks.prisma.$transaction.mockImplementation((fn) => fn(tx));

    await expect(
      linkDeviceToTarget({
        targetUserId: "target",
        deviceName: "Restored Chrome",
        linkCodeId: "link_1",
      }),
    ).resolves.toEqual({ userId: "target", deviceId: "device_new" });

    expect(tx.device.create).toHaveBeenCalledWith({
      data: { userId: "target", displayName: "Restored Chrome" },
    });
    expect(tx.identityEvent.create).toHaveBeenCalledWith({
      data: {
        type: "DEVICE_LINKED",
        userId: "target",
        deviceId: "device_new",
        reason: "LINK_CODE_WITHOUT_SESSION",
      },
    });
  });
});
