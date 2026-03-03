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
vi.mock("@/lib/upload-gc", () => ({
  tryDeleteManagedUploadIfUnreferenced: mocks.tryDeleteManagedUploadIfUnreferenced,
}));

import { DELETE, GET, PATCH } from "@/app/api/sessions/[sessionId]/route";
import { makeSession, makeSessionItem } from "../../helpers/mocks";
import { jsonRequest, routeCtx } from "../../helpers/request";

describe("session detail route", () => {
  beforeEach(() => {
    mocks.requireSessionAccess.mockReset().mockResolvedValue({ requestUserId: "user_1" });
    mocks.requireSessionOwner.mockReset().mockResolvedValue(undefined);
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
      items: [
        { imageUrl: "/one.webp" },
        { imageUrl: "/one.webp" },
        { imageUrl: "/two.webp" },
      ],
      template: {
        id: "template_1",
        isHidden: false,
        items: [],
        _count: { sessions: 1 },
      },
    });
    response = await DELETE(new Request("https://example.test", { method: "DELETE" }), routeCtx({ sessionId: "s1" }));
    expect(response.status).toBe(204);
    expect(mocks.prisma.session.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
    expect(mocks.prisma.template.delete).not.toHaveBeenCalled();
    expect(mocks.tryDeleteManagedUploadIfUnreferenced).toHaveBeenCalledTimes(2);
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
});
