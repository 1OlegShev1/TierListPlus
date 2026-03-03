const mocks = vi.hoisted(() => ({
  prisma: {
    session: {
      findUnique: vi.fn(),
    },
    template: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  requireSessionAccess: vi.fn(),
  requireRequestAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/api-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-helpers")>("@/lib/api-helpers");
  return {
    ...actual,
    requireSessionAccess: mocks.requireSessionAccess,
  };
});
vi.mock("@/lib/auth", () => ({
  requireRequestAuth: mocks.requireRequestAuth,
}));

import { POST } from "@/app/api/sessions/[sessionId]/template/route";
import { routeCtx } from "../../helpers/request";

describe("session template save route", () => {
  beforeEach(() => {
    mocks.prisma.session.findUnique.mockReset();
    mocks.prisma.template.create.mockReset();
    mocks.prisma.template.update.mockReset();
    mocks.requireSessionAccess.mockReset().mockResolvedValue({ requestUserId: "user_1" });
    mocks.requireRequestAuth.mockReset().mockResolvedValue({ userId: "user_1" });
  });

  it("publishes the hidden working template as a detached visible copy for the owner", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_1",
      name: "Friday's fun",
      creatorId: "user_1",
      isPrivate: true,
      items: [{ label: "Pizza", imageUrl: "/img/pizza.webp", sortOrder: 0 }],
      template: {
        id: "template_1",
        name: "Friday's fun",
        description: null,
        isHidden: true,
      },
    });
    mocks.prisma.template.create.mockResolvedValue({ id: "template_published" });

    const response = await POST(
      new Request("https://example.test", { method: "POST" }),
      routeCtx({ sessionId: "session_1" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.template.create).toHaveBeenCalledWith({
      data: {
        name: "Friday's fun",
        description: null,
        creatorId: "user_1",
        isPublic: false,
        items: {
          create: [{ label: "Pizza", imageUrl: "/img/pizza.webp", sortOrder: 0 }],
        },
      },
      select: { id: true },
    });
    expect(mocks.prisma.template.update).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ id: "template_published", mode: "published" });
  });

  it("publishes the owner's hidden working template with public visibility when the session is public", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_public",
      name: "Open Friday's fun",
      creatorId: "user_1",
      isPrivate: false,
      items: [{ label: "Pizza", imageUrl: "/img/pizza.webp", sortOrder: 0 }],
      template: {
        description: "Public set",
        isHidden: true,
      },
    });
    mocks.prisma.template.create.mockResolvedValue({ id: "template_public" });

    const response = await POST(
      new Request("https://example.test", { method: "POST" }),
      routeCtx({ sessionId: "session_public" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.template.create).toHaveBeenCalledWith({
      data: {
        name: "Open Friday's fun",
        description: "Public set",
        creatorId: "user_1",
        isPublic: true,
        items: {
          create: [{ label: "Pizza", imageUrl: "/img/pizza.webp", sortOrder: 0 }],
        },
      },
      select: { id: true },
    });
    await expect(response.json()).resolves.toEqual({ id: "template_public", mode: "published" });
  });

  it("creates a copy for visible-template sessions instead of returning an inert existing result", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_legacy",
      name: "Legacy session",
      creatorId: "user_1",
      isPrivate: false,
      items: [{ label: "Burger", imageUrl: "/img/burger.webp", sortOrder: 0 }],
      template: {
        id: "template_original",
        name: "Burgers of Oslo",
        description: "Original",
        isHidden: false,
      },
    });
    mocks.prisma.template.create.mockResolvedValue({ id: "template_copy" });

    const response = await POST(
      new Request("https://example.test", { method: "POST" }),
      routeCtx({ sessionId: "session_legacy" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.template.create).toHaveBeenCalledWith({
      data: {
        name: "Legacy session",
        description: "Original",
        creatorId: "user_1",
        isPublic: false,
        items: {
          create: [{ label: "Burger", imageUrl: "/img/burger.webp", sortOrder: 0 }],
        },
      },
      select: { id: true },
    });
    await expect(response.json()).resolves.toEqual({ id: "template_copy", mode: "copied" });
  });

  it("creates a private copy for non-owners", async () => {
    mocks.prisma.session.findUnique.mockResolvedValue({
      id: "session_1",
      name: "Friday's fun",
      creatorId: "user_2",
      isPrivate: false,
      items: [{ label: "One", imageUrl: "/img/1.webp", sortOrder: 0 }],
      template: {
        id: "template_1",
        name: "Friday's fun",
        description: null,
        isHidden: true,
      },
    });
    mocks.prisma.template.create.mockResolvedValue({ id: "template_copy_2" });

    const response = await POST(
      new Request("https://example.test", { method: "POST" }),
      routeCtx({ sessionId: "session_1" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.template.create).toHaveBeenCalledWith({
      data: {
        name: "Friday's fun (Copy)",
        description: null,
        creatorId: "user_1",
        isPublic: false,
        items: {
          create: [{ label: "One", imageUrl: "/img/1.webp", sortOrder: 0 }],
        },
      },
      select: { id: true },
    });
    await expect(response.json()).resolves.toEqual({ id: "template_copy_2", mode: "copied" });
  });
});
