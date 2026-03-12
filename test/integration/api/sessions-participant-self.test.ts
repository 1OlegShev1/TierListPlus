const mocks = vi.hoisted(() => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
    },
    participant: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      updateMany: vi.fn(),
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

import { DELETE, PATCH } from "@/app/api/sessions/[sessionId]/participants/me/route";
import { makeKnownRequestError, makeParticipant } from "../../helpers/mocks";
import { jsonRequest, routeCtx } from "../../helpers/request";

describe("sessions participant self route", () => {
  beforeEach(() => {
    mocks.requireSessionAccess.mockReset().mockResolvedValue({
      requestUserId: "user_1",
      isOwner: false,
      isSpaceOwner: false,
    });
    mocks.prisma.session.findUnique.mockReset().mockResolvedValue({ status: "OPEN" });
    mocks.prisma.participant.findFirst.mockReset();
    mocks.prisma.participant.findUnique.mockReset();
    mocks.prisma.participant.deleteMany.mockReset();
    mocks.prisma.participant.update.mockReset();
    mocks.prisma.user.updateMany.mockReset();
  });

  it("updates the signed-in participant nickname", async () => {
    mocks.prisma.participant.findFirst.mockResolvedValue(makeParticipant({ nickname: "OldNick" }));
    mocks.prisma.participant.findUnique.mockResolvedValue(null);
    mocks.prisma.participant.update.mockResolvedValue({ id: "participant_1", nickname: "NewNick" });
    mocks.prisma.user.updateMany.mockResolvedValue({ count: 1 });

    const response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { nickname: "NewNick" }),
      routeCtx({ sessionId: "session_1" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      participantId: "participant_1",
      nickname: "NewNick",
    });
    expect(mocks.prisma.participant.update).toHaveBeenCalledWith({
      where: { id: "participant_1" },
      data: { nickname: "NewNick" },
      select: { id: true, nickname: true },
    });
  });

  it("returns early when nickname does not change", async () => {
    mocks.prisma.participant.findFirst.mockResolvedValue(makeParticipant({ nickname: "SameNick" }));

    const response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { nickname: "SameNick" }),
      routeCtx({ sessionId: "session_1" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      participantId: "participant_1",
      nickname: "SameNick",
    });
    expect(mocks.prisma.participant.update).not.toHaveBeenCalled();
  });

  it("rejects duplicate nicknames", async () => {
    mocks.prisma.participant.findFirst.mockResolvedValue(makeParticipant({ nickname: "OldNick" }));
    mocks.prisma.participant.findUnique.mockResolvedValue({ id: "participant_2" });

    const response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { nickname: "TakenNick" }),
      routeCtx({ sessionId: "session_1" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: "Nickname is already taken in this session",
      }),
    );
  });

  it("maps unique constraint collisions to validation errors", async () => {
    mocks.prisma.participant.findFirst.mockResolvedValue(makeParticipant({ nickname: "OldNick" }));
    mocks.prisma.participant.findUnique.mockResolvedValue(null);
    mocks.prisma.participant.update.mockRejectedValue(
      makeKnownRequestError("P2002", ["sessionId", "nickname"]),
    );

    const response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { nickname: "TakenNick" }),
      routeCtx({ sessionId: "session_1" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: "Nickname is already taken in this session",
      }),
    );
  });

  it("deletes the signed-in participant while vote is open", async () => {
    mocks.prisma.participant.deleteMany.mockResolvedValue({ count: 1 });

    const response = await DELETE(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ sessionId: "session_1" }),
    );

    expect(response.status).toBe(204);
    expect(mocks.prisma.participant.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "session_1", userId: "user_1" },
    });
  });

  it("allows non-host space managers to leave", async () => {
    mocks.requireSessionAccess.mockResolvedValue({
      requestUserId: "user_1",
      isOwner: false,
      isSpaceOwner: true,
    });
    mocks.prisma.participant.deleteMany.mockResolvedValue({ count: 1 });

    const response = await DELETE(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ sessionId: "session_1" }),
    );

    expect(response.status).toBe(204);
    expect(mocks.prisma.participant.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: "session_1", userId: "user_1" },
    });
  });

  it("rejects leave when vote is closed", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue({ status: "CLOSED" });

    const response = await DELETE(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ sessionId: "session_1" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: "This vote is closed. Leaving is only available while voting is open.",
      }),
    );
    expect(mocks.prisma.participant.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects leave when user is not currently joined", async () => {
    mocks.prisma.participant.deleteMany.mockResolvedValue({ count: 0 });

    const response = await DELETE(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ sessionId: "session_1" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: "Join this vote before leaving",
      }),
    );
  });

  it("rejects vote owners trying to leave", async () => {
    mocks.requireSessionAccess.mockResolvedValue({
      requestUserId: "user_1",
      isOwner: true,
      isSpaceOwner: false,
    });

    const response = await DELETE(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ sessionId: "session_1" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: "Vote owners cannot leave this vote",
      }),
    );
    expect(mocks.prisma.session.findUnique).not.toHaveBeenCalled();
  });
});
