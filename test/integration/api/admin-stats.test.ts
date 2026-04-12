const mocks = vi.hoisted(() => ({
  prisma: {
    user: { count: vi.fn() },
    template: { count: vi.fn() },
    session: { count: vi.fn() },
    participant: { count: vi.fn() },
  },
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/api-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-helpers")>("@/lib/api-helpers");
  return {
    ...actual,
    requireAdmin: mocks.requireAdmin,
  };
});

import { GET } from "@/app/api/admin/stats/route";

describe("admin stats route", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset().mockResolvedValue({
      userId: "admin_1",
      deviceId: "device_admin_1",
      role: "ADMIN",
      device: {},
    });
    mocks.prisma.user.count.mockReset().mockResolvedValue(0);
    mocks.prisma.template.count.mockReset().mockResolvedValue(0);
    mocks.prisma.session.count.mockReset().mockResolvedValue(0);
    mocks.prisma.participant.count.mockReset().mockResolvedValue(0);
  });

  it("returns aggregate platform stats for admins", async () => {
    mocks.prisma.user.count
      .mockResolvedValueOnce(42)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(19);
    mocks.prisma.template.count
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    mocks.prisma.session.count
      .mockResolvedValueOnce(31)
      .mockResolvedValueOnce(11)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(12);
    mocks.prisma.participant.count
      .mockResolvedValueOnce(101)
      .mockResolvedValueOnce(16)
      .mockResolvedValueOnce(8);

    const response = await GET(new Request("https://example.test/api/admin/stats"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
        windows: expect.objectContaining({
          last24hStart: expect.any(String),
          last7dStart: expect.any(String),
        }),
        totals: {
          users: 42,
          usersActive7d: 19,
          publicTemplatesAvailable: 9,
          publicTemplatesModerated: 2,
          sessions: 31,
          publicSessionsAvailable: 11,
          publicSessionsModerated: 4,
          openSessions: 5,
          participants: 101,
        },
        recent: {
          usersCreated24h: 2,
          usersCreated7d: 7,
          publicTemplatesCreated7d: 3,
          sessionsCreated24h: 4,
          sessionsCreated7d: 12,
          participantsJoined7d: 16,
          participantsSubmitted7d: 8,
        },
      }),
    );

    expect(mocks.requireAdmin).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when requester is not an admin", async () => {
    mocks.requireAdmin.mockRejectedValueOnce({ status: 403, details: "admin role required" });

    const response = await GET(new Request("https://example.test/api/admin/stats"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "admin role required" });
  });
});
