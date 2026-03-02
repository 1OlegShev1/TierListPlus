const mocks = vi.hoisted(() => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
    },
    participant: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  requireRequestAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  requireRequestAuth: mocks.requireRequestAuth,
}));

import { POST } from "@/app/api/sessions/join/route";
import { makeParticipant, makeSession } from "../../helpers/mocks";
import { jsonRequest } from "../../helpers/request";

describe("sessions join route", () => {
  beforeEach(() => {
    mocks.prisma.session.findUnique.mockReset();
    mocks.prisma.participant.findFirst.mockReset();
    mocks.prisma.participant.findUnique.mockReset();
    mocks.prisma.participant.create.mockReset();
    mocks.prisma.participant.update.mockReset();
    mocks.requireRequestAuth.mockReset().mockResolvedValue({ userId: "user_1" });
  });

  it("returns 404 for unknown sessions and rejects locked/non-open sessions", async () => {
    let response = await POST(
      jsonRequest("POST", "https://example.test", { joinCode: "join1", nickname: "Nick" }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(404);

    mocks.prisma.session.findUnique.mockResolvedValueOnce(makeSession({ status: "CLOSED" }));
    response = await POST(
      jsonRequest("POST", "https://example.test", { joinCode: "join1", nickname: "Nick" }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(400);

    mocks.prisma.session.findUnique.mockResolvedValueOnce(makeSession({ isLocked: true }));
    mocks.prisma.participant.findFirst.mockResolvedValue(null);
    mocks.prisma.participant.findUnique.mockResolvedValue(null);
    response = await POST(
      jsonRequest("POST", "https://example.test", { joinCode: "join1", nickname: "Nick" }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(400);
  });

  it("reuses an existing participant or creates a new one", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue(makeSession());
    mocks.prisma.participant.findFirst.mockResolvedValueOnce(
      makeParticipant({ id: "participant_existing" }),
    );

    let response = await POST(
      jsonRequest("POST", "https://example.test", { joinCode: "join1", nickname: "Nick" }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ participantId: "participant_existing" }),
    );

    mocks.prisma.participant.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.participant.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.participant.create.mockResolvedValueOnce(
      makeParticipant({ id: "participant_new", nickname: "Nick" }),
    );

    response = await POST(
      jsonRequest("POST", "https://example.test", { joinCode: "join1", nickname: "Nick" }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ participantId: "participant_new", nickname: "Nick" }),
    );
  });
});
