const mocks = vi.hoisted(() => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
    },
    tierVote: {
      findMany: vi.fn(),
    },
  },
  requireSessionAccess: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/api-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-helpers")>("@/lib/api-helpers");
  return {
    ...actual,
    requireSessionAccess: mocks.requireSessionAccess,
  };
});

import { GET } from "@/app/api/sessions/[sessionId]/votes/consensus/route";
import { makeSessionItem } from "../../helpers/mocks";
import { routeCtx } from "../../helpers/request";

describe("session consensus route", () => {
  beforeEach(() => {
    mocks.prisma.session.findUnique.mockReset();
    mocks.prisma.tierVote.findMany.mockReset();
    mocks.requireSessionAccess.mockReset().mockResolvedValue(undefined);
  });

  it("returns 404 for missing sessions", async () => {
    const response = await GET(new Request("https://example.test"), routeCtx({ sessionId: "s1" }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Session not found" });
  });

  it("returns computed consensus tiers", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue({
      tierConfig: [
        { key: "S", label: "S", color: "#111111", sortOrder: 0 },
        { key: "A", label: "A", color: "#222222", sortOrder: 1 },
      ],
      items: [makeSessionItem({ id: "i1" }), makeSessionItem({ id: "i2", sortOrder: 1 })],
    });
    mocks.prisma.tierVote.findMany.mockResolvedValue([
      {
        participantId: "p1",
        participant: { nickname: "Alice" },
        sessionItemId: "i1",
        tierKey: "S",
        rankInTier: 0,
      },
      {
        participantId: "p1",
        participant: { nickname: "Alice" },
        sessionItemId: "i2",
        tierKey: "A",
        rankInTier: 0,
      },
    ]);

    const response = await GET(new Request("https://example.test"), routeCtx({ sessionId: "s1" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({
        key: "S",
        items: [expect.objectContaining({ id: "i1", voterNicknamesByTier: { S: ["Alice"] } })],
      }),
      expect.objectContaining({
        key: "A",
        items: [expect.objectContaining({ id: "i2", voterNicknamesByTier: { A: ["Alice"] } })],
      }),
    ]);
  });
});
