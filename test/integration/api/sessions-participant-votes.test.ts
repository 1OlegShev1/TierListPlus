const mocks = vi.hoisted(() => ({
  prisma: {
    tierVote: {
      findMany: vi.fn(),
    },
  },
  requireSessionAccess: vi.fn(),
  verifyParticipant: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/api-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-helpers")>("@/lib/api-helpers");
  return {
    ...actual,
    requireSessionAccess: mocks.requireSessionAccess,
    verifyParticipant: mocks.verifyParticipant,
  };
});

import { GET } from "@/app/api/sessions/[sessionId]/votes/[participantId]/route";
import { makeParticipant } from "../../helpers/mocks";
import { routeCtx } from "../../helpers/request";

describe("participant votes route", () => {
  beforeEach(() => {
    mocks.prisma.tierVote.findMany.mockReset();
    mocks.requireSessionAccess.mockReset().mockResolvedValue(undefined);
    mocks.verifyParticipant.mockReset().mockResolvedValue(makeParticipant({ id: "participant_1" }));
  });

  it("returns 404 when no submitted votes exist", async () => {
    mocks.prisma.tierVote.findMany.mockResolvedValue([]);

    const response = await GET(new Request("https://example.test"), routeCtx({
      sessionId: "s1",
      participantId: "participant_1",
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "This participant has not submitted votes yet",
    });
  });

  it("returns participant vote details", async () => {
    mocks.prisma.tierVote.findMany.mockResolvedValue([
      {
        sessionItem: { id: "i1", label: "One", imageUrl: "/1.webp" },
        rankInTier: 0,
      },
    ]);

    const response = await GET(new Request("https://example.test"), routeCtx({
      sessionId: "s1",
      participantId: "participant_1",
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      participant: expect.objectContaining({ id: "participant_1" }),
      votes: [expect.objectContaining({ rankInTier: 0 })],
    });
  });
});
