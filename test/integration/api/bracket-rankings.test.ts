const mocks = vi.hoisted(() => ({
  prisma: {
    bracket: {
      findFirst: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
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

import { GET } from "@/app/api/sessions/[sessionId]/bracket/rankings/route";
import { makeSession } from "../../helpers/mocks";
import { routeCtx } from "../../helpers/request";

describe("bracket rankings route", () => {
  beforeEach(() => {
    mocks.prisma.bracket.findFirst.mockReset();
    mocks.prisma.session.findUnique.mockReset();
    mocks.requireSessionAccess.mockReset().mockResolvedValue(undefined);
  });

  it("returns evenly distributed seeded tiers", async () => {
    mocks.prisma.bracket.findFirst.mockResolvedValue({
      rounds: 2,
      matchups: [
        { round: 1, position: 0, itemAId: "a", itemBId: "b", winnerId: "a" },
        { round: 1, position: 1, itemAId: "c", itemBId: "d", winnerId: "c" },
        { round: 2, position: 0, itemAId: "a", itemBId: "c", winnerId: "a" },
      ],
    });
    mocks.prisma.session.findUnique.mockResolvedValue(
      makeSession({
        tierConfig: [
          { key: "S", label: "S", color: "#111111", sortOrder: 0 },
          { key: "A", label: "A", color: "#222222", sortOrder: 1 },
        ],
        items: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
      }),
    );

    const response = await GET(new Request("https://example.test"), routeCtx({ sessionId: "s1" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      seededTiers: {
        S: ["a", "c"],
        A: ["b", "d"],
      },
    });
  });
});
