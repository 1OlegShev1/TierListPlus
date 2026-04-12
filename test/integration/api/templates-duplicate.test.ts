const mocks = vi.hoisted(() => ({
  prisma: {
    template: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
  requireRequestAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  requireRequestAuth: mocks.requireRequestAuth,
}));

import { POST } from "@/app/api/templates/[templateId]/duplicate/route";
import { makeTemplate } from "../../helpers/mocks";
import { routeCtx } from "../../helpers/request";

describe("template duplicate route", () => {
  beforeEach(() => {
    mocks.prisma.template.findUnique.mockReset();
    mocks.prisma.template.create.mockReset();
    mocks.requireRequestAuth.mockReset().mockResolvedValue({ userId: "user_1" });
  });

  it("hides inaccessible templates and duplicates accessible ones as private copies", async () => {
    mocks.prisma.template.findUnique
      .mockResolvedValueOnce(makeTemplate({ creatorId: "user_2", isPublic: false }))
      .mockResolvedValueOnce(
        makeTemplate({
          creatorId: "user_2",
          isPublic: true,
          name: "Top List",
          description: "desc",
          items: [{ label: "One", imageUrl: "/1.webp", sortOrder: 0 }],
        }),
      );
    mocks.prisma.template.create.mockResolvedValue({ id: "copy_1" });

    let response = await POST(
      new Request("https://example.test", { method: "POST" }),
      routeCtx({ templateId: "t1" }),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Template not found" });

    response = await POST(
      new Request("https://example.test", { method: "POST" }),
      routeCtx({ templateId: "t1" }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: "copy_1" });
    expect(mocks.prisma.template.create).toHaveBeenCalledWith({
      data: {
        name: "Top List (Copy)",
        description: "desc",
        creatorId: "user_1",
        isPublic: false,
        items: {
          create: [{ label: "One", imageUrl: "/1.webp", sortOrder: 0 }],
        },
      },
    });
  });
});
