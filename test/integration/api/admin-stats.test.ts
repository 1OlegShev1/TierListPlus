const mocks = vi.hoisted(() => ({
  prisma: {
    user: { count: vi.fn() },
    template: { count: vi.fn() },
    session: { count: vi.fn() },
    participant: { count: vi.fn() },
    space: { count: vi.fn() },
    device: { count: vi.fn() },
    tierVote: { count: vi.fn() },
    $queryRaw: vi.fn(),
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
    mocks.prisma.space.count.mockReset().mockResolvedValue(0);
    mocks.prisma.device.count.mockReset().mockResolvedValue(0);
    mocks.prisma.tierVote.count.mockReset().mockResolvedValue(0);
    // Raw queries back the time-series; empty rows -> zeroed series.
    mocks.prisma.$queryRaw.mockReset().mockResolvedValue([]);
  });

  it("returns aggregate platform stats for admins", async () => {
    // Order matches the Promise.all in the route.
    mocks.prisma.user.count
      .mockResolvedValueOnce(42) // total
      .mockResolvedValueOnce(2) // created 24h
      .mockResolvedValueOnce(19) // active 7d
      .mockResolvedValueOnce(1) // moderators
      .mockResolvedValueOnce(1); // admins
    mocks.prisma.template.count
      .mockResolvedValueOnce(9) // public available
      .mockResolvedValueOnce(2) // public moderated
      .mockResolvedValueOnce(15); // total
    mocks.prisma.session.count
      .mockResolvedValueOnce(31) // total
      .mockResolvedValueOnce(11) // public available
      .mockResolvedValueOnce(4) // public moderated
      .mockResolvedValueOnce(5) // open
      .mockResolvedValueOnce(6) // closed
      .mockResolvedValueOnce(7) // archived
      .mockResolvedValueOnce(4); // created 24h
    mocks.prisma.participant.count
      .mockResolvedValueOnce(101) // total
      .mockResolvedValueOnce(16) // joined 24h
      .mockResolvedValueOnce(8); // submitted 24h
    mocks.prisma.space.count.mockResolvedValueOnce(3);
    mocks.prisma.device.count.mockResolvedValueOnce(20);
    mocks.prisma.tierVote.count.mockResolvedValueOnce(500);

    const response = await GET(new Request("https://example.test/api/admin/stats"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
        windows: expect.objectContaining({
          last24hStart: expect.any(String),
          last7dStart: expect.any(String),
          seriesStart: expect.any(String),
          seriesDays: 90,
        }),
        totals: {
          users: 42,
          usersActive7d: 19,
          moderators: 1,
          admins: 1,
          publicTemplatesAvailable: 9,
          publicTemplatesModerated: 2,
          templates: 15,
          sessions: 31,
          publicSessionsAvailable: 11,
          publicSessionsModerated: 4,
          openSessions: 5,
          closedSessions: 6,
          archivedSessions: 7,
          participants: 101,
          spaces: 3,
          activeDevices7d: 20,
          votes: 500,
        },
        recent: {
          usersCreated24h: 2,
          sessionsCreated24h: 4,
          participantsJoined24h: 16,
          participantsSubmitted24h: 8,
        },
      }),
    );

    // Time-series grid is 90 aligned days with created/cumulative arrays per metric.
    expect(body.series.days).toHaveLength(90);
    for (const key of ["users", "sessions", "publicTemplates", "participants", "submissions"]) {
      expect(body.series[key].created).toHaveLength(90);
      expect(body.series[key].cumulative).toHaveLength(90);
    }

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
