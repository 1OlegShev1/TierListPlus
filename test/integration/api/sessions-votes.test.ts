const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    tierVote: {
      findMany: vi.fn(),
    },
    sessionItem: {
      count: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
    },
  },
  requireSessionAccess: vi.fn(),
  requireOpenSession: vi.fn(),
  requireParticipantOwner: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/api-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-helpers")>("@/lib/api-helpers");
  return {
    ...actual,
    requireSessionAccess: mocks.requireSessionAccess,
    requireOpenSession: mocks.requireOpenSession,
    requireParticipantOwner: mocks.requireParticipantOwner,
  };
});

import { GET, POST } from "@/app/api/sessions/[sessionId]/votes/route";
import { ApiError } from "@/lib/api-helpers";
import { routeCtx } from "../../helpers/request";

describe("sessions votes route", () => {
  beforeEach(() => {
    mocks.requireSessionAccess.mockResolvedValue(undefined);
    mocks.requireOpenSession.mockResolvedValue(undefined);
    mocks.requireParticipantOwner.mockResolvedValue({ id: "participant_canonical" });
    mocks.prisma.tierVote.findMany.mockReset();
    mocks.prisma.sessionItem.count.mockReset();
    mocks.prisma.session.findUnique.mockReset();
    mocks.prisma.$transaction.mockReset();
  });

  it("returns votes on GET", async () => {
    mocks.prisma.tierVote.findMany.mockResolvedValue([{ id: "vote_1" }]);

    const response = await GET(new Request("https://example.test"), routeCtx({ sessionId: "s1" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([{ id: "vote_1" }]);
    expect(mocks.prisma.tierVote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionItem: { sessionId: "s1" } } }),
    );
  });

  it("rejects empty votes, duplicates, incomplete rankings, invalid items, and invalid tiers", async () => {
    const baseRequest = (votes: unknown[]) =>
      new Request("https://example.test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantId: "p1", votes }),
      });

    let response = await POST(baseRequest([]), routeCtx({ sessionId: "s1" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "At least one ranking is required" });

    const duplicateVotes = [
      { sessionItemId: "i1", tierKey: "S", rankInTier: 0 },
      { sessionItemId: "i1", tierKey: "A", rankInTier: 1 },
    ];
    response = await POST(baseRequest(duplicateVotes), routeCtx({ sessionId: "s1" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Duplicate rankings for the same item are not allowed",
    });

    mocks.prisma.sessionItem.count.mockResolvedValueOnce(3);
    response = await POST(
      baseRequest([{ sessionItemId: "i1", tierKey: "S", rankInTier: 0 }]),
      routeCtx({ sessionId: "s1" }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "All session items must be ranked before submitting",
    });

    mocks.prisma.sessionItem.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    response = await POST(
      baseRequest([{ sessionItemId: "i1", tierKey: "S", rankInTier: 0 }]),
      routeCtx({ sessionId: "s1" }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "One or more rankings reference items outside this session",
    });

    mocks.prisma.sessionItem.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    mocks.prisma.session.findUnique.mockResolvedValue({
      tierConfig: [{ key: "A", label: "A", color: "#ffffff", sortOrder: 0 }],
    });
    response = await POST(
      baseRequest([{ sessionItemId: "i1", tierKey: "S", rankInTier: 0 }]),
      routeCtx({ sessionId: "s1" }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid tier key: S" });
  });

  it("rewrites votes transactionally using the canonical participant id", async () => {
    const deleteMany = vi.fn();
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const update = vi.fn();
    mocks.prisma.sessionItem.count.mockResolvedValueOnce(2).mockResolvedValueOnce(2);
    mocks.prisma.session.findUnique.mockResolvedValue({
      tierConfig: [{ key: "S", label: "S", color: "#ffffff", sortOrder: 0 }],
    });
    mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        tierVote: { deleteMany, createMany },
        participant: { update },
      }),
    );

    const response = await POST(
      new Request("https://example.test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participantId: "client_participant",
          votes: [
            { sessionItemId: "i1", tierKey: "S", rankInTier: 0 },
            { sessionItemId: "i2", tierKey: "S", rankInTier: 1 },
          ],
        }),
      }),
      routeCtx({ sessionId: "s1" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ createdCount: 2 });
    expect(deleteMany).toHaveBeenCalledWith({ where: { participantId: "participant_canonical" } });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          participantId: "participant_canonical",
          sessionItemId: "i1",
          tierKey: "S",
          rankInTier: 0,
        },
        {
          participantId: "participant_canonical",
          sessionItemId: "i2",
          tierKey: "S",
          rankInTier: 1,
        },
      ],
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "participant_canonical" },
      data: { submittedAt: expect.any(Date) },
    });
  });

  it("maps access failures through withHandler", async () => {
    mocks.requireSessionAccess.mockRejectedValue(new ApiError(403, "Blocked"));

    const response = await GET(new Request("https://example.test"), routeCtx({ sessionId: "s1" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Blocked" });
  });
});
