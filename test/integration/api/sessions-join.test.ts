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
    user: {
      updateMany: vi.fn(),
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
    mocks.prisma.user.updateMany.mockReset();
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

  it("enforces private-space membership and allows open-space non-members", async () => {
    mocks.prisma.session.findUnique.mockResolvedValueOnce(
      makeSession({
        space: {
          id: "space_private_1",
          name: "Anime Club",
          visibility: "PRIVATE",
          members: [],
        },
      }),
    );

    let response = await POST(
      jsonRequest("POST", "https://example.test", { joinCode: "join1", nickname: "Nick" }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only members of this private space can join this vote",
      code: "SPACE_MEMBERSHIP_REQUIRED",
      spaceId: "space_private_1",
      spaceName: "Anime Club",
      spaceVisibility: "PRIVATE",
    });

    mocks.prisma.session.findUnique.mockResolvedValueOnce(
      makeSession({
        id: "session_open_space",
        space: {
          visibility: "OPEN",
          members: [],
        },
      }),
    );
    mocks.prisma.participant.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.participant.findUnique.mockResolvedValueOnce(null);
    mocks.prisma.participant.create.mockResolvedValueOnce(
      makeParticipant({ id: "participant_open_space", nickname: "Nick" }),
    );

    response = await POST(
      jsonRequest("POST", "https://example.test", { joinCode: "join1", nickname: "Nick" }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        sessionId: "session_open_space",
        participantId: "participant_open_space",
      }),
    );
  });

  it("reuses an existing participant or creates a new one", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue(makeSession());
    mocks.prisma.participant.findFirst.mockResolvedValueOnce(
      makeParticipant({ id: "participant_existing" }),
    );
    mocks.prisma.user.updateMany.mockRejectedValueOnce(new Error("write failed"));

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
