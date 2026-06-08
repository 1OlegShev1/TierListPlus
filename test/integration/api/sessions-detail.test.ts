const mocks = vi.hoisted(() => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    template: {
      delete: vi.fn(),
    },
  },
  requireSessionAccess: vi.fn(),
  requireSessionOwner: vi.fn(),
  getRequestAuth: vi.fn(),
  tryDeleteManagedUploadIfUnreferenced: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/api-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-helpers")>("@/lib/api-helpers");
  return {
    ...actual,
    requireSessionAccess: mocks.requireSessionAccess,
    requireSessionOwner: mocks.requireSessionOwner,
  };
});
vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getRequestAuth: mocks.getRequestAuth };
});
vi.mock("@/lib/upload-gc", () => ({
  tryDeleteManagedUploadIfUnreferenced: mocks.tryDeleteManagedUploadIfUnreferenced,
}));

import { DELETE, GET, PATCH } from "@/app/api/sessions/[sessionId]/route";
import { ApiError } from "@/lib/api-helpers";
import { makeSession, makeSessionItem } from "../../helpers/mocks";
import { jsonRequest, routeCtx } from "../../helpers/request";

describe("session detail route", () => {
  beforeEach(() => {
    // GET uses requireSessionAccess; DELETE/PATCH use requireSessionOwner.
    mocks.requireSessionAccess.mockReset().mockResolvedValue({ requestUserId: "user_1" });
    mocks.requireSessionOwner.mockReset().mockResolvedValue(undefined);
    // Default: a plain signed-in user (not a moderator) → DELETE falls back to
    // the requireSessionOwner ownership check.
    mocks.getRequestAuth.mockReset().mockResolvedValue({ userId: "user_1", role: "USER" });
    mocks.prisma.session.findUnique.mockReset();
    mocks.prisma.session.update.mockReset();
    mocks.prisma.session.delete.mockReset();
    mocks.prisma.template.delete.mockReset();
    mocks.tryDeleteManagedUploadIfUnreferenced.mockReset().mockResolvedValue(true);
  });

  it("returns session detail with current participant info", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue(
      makeSession({
        items: [makeSessionItem()],
        participants: [
          {
            id: "participant_1",
            userId: "user_1",
            nickname: "Oleg",
            submittedAt: null,
            _count: { tierVotes: 1 },
          },
        ],
        _count: { participants: 1 },
        template: { name: "Template" },
      }),
    );

    const response = await GET(new Request("https://example.test"), routeCtx({ sessionId: "s1" }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual(
      expect.not.objectContaining({
        sourceTemplateId: expect.anything(),
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        canManageItems: false,
        currentParticipantId: "participant_1",
        currentParticipantNickname: "Oleg",
        participants: [expect.objectContaining({ hasSubmitted: true })],
      }),
    );
  });

  it("patches updates and deletes visible-template sessions without deleting the template", async () => {
    mocks.prisma.session.update.mockResolvedValue(makeSession({ isLocked: true }));
    let response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { isLocked: true }),
      routeCtx({ sessionId: "s1" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ isLocked: true }));

    mocks.prisma.session.findUnique.mockResolvedValue({
      items: [{ imageUrl: "/one.webp" }, { imageUrl: "/one.webp" }, { imageUrl: "/two.webp" }],
      template: {
        id: "template_1",
        isHidden: false,
        items: [],
        _count: { sessions: 1 },
      },
    });
    response = await DELETE(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ sessionId: "s1" }),
    );
    expect(response.status).toBe(204);
    expect(mocks.prisma.session.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
    expect(mocks.prisma.template.delete).not.toHaveBeenCalled();
    expect(mocks.tryDeleteManagedUploadIfUnreferenced).toHaveBeenCalledTimes(2);
  });

  it("allows the owner to close a session", async () => {
    mocks.prisma.session.update.mockResolvedValue(makeSession({ status: "CLOSED" }));

    const response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { status: "CLOSED" }),
      routeCtx({ sessionId: "s1" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ status: "CLOSED" }));
    expect(mocks.prisma.session.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "CLOSED" },
    });
  });

  it("allows the owner to reopen a closed session", async () => {
    mocks.prisma.session.update.mockResolvedValue(makeSession({ status: "OPEN" }));

    const response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { status: "OPEN" }),
      routeCtx({ sessionId: "s1" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ status: "OPEN" }));
    expect(mocks.prisma.session.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "OPEN" },
    });
  });

  it("allows the owner to rename a session", async () => {
    mocks.prisma.session.update.mockResolvedValue(makeSession({ name: "Renamed vote" }));

    const response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { name: "Renamed vote" }),
      routeCtx({ sessionId: "s1" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ name: "Renamed vote" }),
    );
    expect(mocks.prisma.session.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { name: "Renamed vote" },
    });
  });

  it("deletes the hidden working template when removing its last session", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue({
      items: [{ imageUrl: "/one.webp" }, { imageUrl: "/two.webp" }],
      template: {
        id: "template_hidden_1",
        isHidden: true,
        items: [{ imageUrl: "/two.webp" }, { imageUrl: "/three.webp" }],
        _count: { sessions: 1 },
      },
    });

    const response = await DELETE(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ sessionId: "s1" }),
    );

    expect(response.status).toBe(204);
    expect(mocks.prisma.session.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
    expect(mocks.prisma.template.delete).toHaveBeenCalledWith({
      where: { id: "template_hidden_1" },
    });
    expect(mocks.tryDeleteManagedUploadIfUnreferenced).toHaveBeenCalledTimes(3);
    expect(mocks.tryDeleteManagedUploadIfUnreferenced).toHaveBeenCalledWith(
      "/three.webp",
      "session + working template delete",
    );
  });

  it("keeps a shared hidden working template when other sessions still reference it", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue({
      items: [{ imageUrl: "/one.webp" }, { imageUrl: "/one.webp" }],
      template: {
        id: "template_hidden_2",
        isHidden: true,
        items: [{ imageUrl: "/two.webp" }],
        _count: { sessions: 2 },
      },
    });

    const response = await DELETE(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ sessionId: "s1" }),
    );

    expect(response.status).toBe(204);
    expect(mocks.prisma.template.delete).not.toHaveBeenCalled();
    expect(mocks.tryDeleteManagedUploadIfUnreferenced).toHaveBeenCalledTimes(1);
    expect(mocks.tryDeleteManagedUploadIfUnreferenced).toHaveBeenCalledWith(
      "/one.webp",
      "session delete",
    );
  });

  it("lets a moderator delete another user's ranking without an ownership check", async () => {
    mocks.getRequestAuth.mockResolvedValue({ userId: "mod_user", role: "MODERATOR" });
    mocks.prisma.session.findUnique.mockResolvedValue({
      items: [],
      template: { id: "template_1", isHidden: false, items: [], _count: { sessions: 1 } },
    });

    const response = await DELETE(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ sessionId: "s1" }),
    );

    expect(response.status).toBe(204);
    // Moderators bypass the owner gate entirely.
    expect(mocks.requireSessionOwner).not.toHaveBeenCalled();
    expect(mocks.prisma.session.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("forbids a non-owner, non-moderator from deleting someone else's ranking", async () => {
    mocks.getRequestAuth.mockResolvedValue({ userId: "rando_user", role: "USER" });
    // Non-moderators go through requireSessionOwner, which rejects non-owners.
    mocks.requireSessionOwner.mockRejectedValueOnce(new ApiError(403, "Not authorized"));

    const response = await DELETE(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ sessionId: "s1" }),
    );

    expect(response.status).toBe(403);
    expect(mocks.prisma.session.delete).not.toHaveBeenCalled();
  });
});
