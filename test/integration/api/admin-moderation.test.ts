const mocks = vi.hoisted(() => ({
  prisma: {
    template: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    session: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  requireModerator: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/api-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-helpers")>("@/lib/api-helpers");
  return {
    ...actual,
    requireModerator: mocks.requireModerator,
  };
});

import { GET as listPublicContent } from "@/app/api/admin/public-content/route";
import { PATCH as moderateSession } from "@/app/api/admin/sessions/[sessionId]/moderation/route";
import { PATCH as moderateTemplate } from "@/app/api/admin/templates/[templateId]/moderation/route";

describe("admin moderation routes", () => {
  beforeEach(() => {
    mocks.requireModerator.mockReset().mockResolvedValue({
      userId: "mod_1",
      deviceId: "device_mod_1",
      role: "MODERATOR",
      device: {},
    });
    mocks.prisma.template.findMany.mockReset().mockResolvedValue([]);
    mocks.prisma.template.findUnique.mockReset();
    mocks.prisma.template.update.mockReset();
    mocks.prisma.session.findMany.mockReset().mockResolvedValue([]);
    mocks.prisma.session.findUnique.mockReset();
    mocks.prisma.session.update.mockReset();
  });

  it("lists public and moderated content for moderators", async () => {
    mocks.prisma.template.findMany.mockResolvedValueOnce([{ id: "template_1" }]);
    mocks.prisma.session.findMany.mockResolvedValueOnce([{ id: "session_1" }]);

    const response = await listPublicContent(
      new Request("https://example.test/api/admin/public-content?limit=10"),
      {
        params: Promise.resolve({}),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
        templates: [{ id: "template_1" }],
        sessions: [{ id: "session_1" }],
      }),
    );
    expect(mocks.prisma.template.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          spaceId: null,
          isHidden: false,
          isPublic: true,
        }),
      }),
    );
    expect(mocks.prisma.session.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          spaceId: null,
          isPrivate: false,
        }),
      }),
    );
    expect(mocks.requireModerator).toHaveBeenCalledTimes(1);
  });

  it("moderates a public template", async () => {
    mocks.prisma.template.findUnique.mockResolvedValueOnce({
      id: "template_1",
      spaceId: null,
      isPublic: true,
      isHidden: false,
      isModeratedHidden: false,
    });
    mocks.prisma.template.update.mockResolvedValueOnce({
      id: "template_1",
      isPublic: true,
      isModeratedHidden: true,
      moderationReason: "stale content",
      moderatedAt: new Date("2026-03-11T12:00:00.000Z"),
      moderatedByUserId: "mod_1",
      updatedAt: new Date("2026-03-11T12:00:00.000Z"),
    });

    const response = await moderateTemplate(
      new Request("https://example.test/api/admin/templates/template_1/moderation", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hidden: true, reason: "stale content" }),
      }),
      { params: Promise.resolve({ templateId: "template_1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        id: "template_1",
        isModeratedHidden: true,
        moderationReason: "stale content",
      }),
    );
    expect(mocks.prisma.template.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "template_1" },
        data: expect.objectContaining({
          isModeratedHidden: true,
          moderatedByUserId: "mod_1",
          moderationReason: "stale content",
        }),
      }),
    );
  });

  it("rejects moderation for private sessions", async () => {
    mocks.prisma.session.findUnique.mockResolvedValueOnce({
      id: "session_1",
      spaceId: null,
      isPrivate: true,
      isModeratedHidden: false,
    });

    const response = await moderateSession(
      new Request("https://example.test/api/admin/sessions/session_1/moderation", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hidden: true, reason: "invalid" }),
      }),
      { params: Promise.resolve({ sessionId: "session_1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Only public sessions can be moderated",
    });
  });
});
