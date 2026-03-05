const mocks = vi.hoisted(() => ({
  prisma: {
    template: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
  getRequestAuth: vi.fn(),
  requireRequestAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  getRequestAuth: mocks.getRequestAuth,
  requireRequestAuth: mocks.requireRequestAuth,
}));

import { GET, POST } from "@/app/api/templates/route";
import { makeTemplate } from "../../helpers/mocks";
import { jsonRequest } from "../../helpers/request";

describe("templates route", () => {
  beforeEach(() => {
    mocks.prisma.template.findMany.mockReset();
    mocks.prisma.template.create.mockReset();
    mocks.getRequestAuth.mockReset().mockResolvedValue(null);
    mocks.requireRequestAuth.mockReset().mockResolvedValue({ userId: "user_1" });
  });

  it("lists templates using visibility filters", async () => {
    mocks.prisma.template.findMany.mockResolvedValue([makeTemplate({ isPublic: true })]);

    const response = await GET(new Request("https://example.test"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ isPublic: true, items: [] }),
    ]);
    expect(mocks.prisma.template.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublic: true, isHidden: false, spaceId: null } }),
    );
    expect(mocks.prisma.template.findMany).toHaveBeenCalledTimes(1);
  });

  it("only loads preview items for the requested leading templates", async () => {
    mocks.prisma.template.findMany
      .mockResolvedValueOnce([
        makeTemplate({ id: "t1", isPublic: true }),
        makeTemplate({ id: "t2", isPublic: true }),
        makeTemplate({ id: "t3", isPublic: true }),
      ])
      .mockResolvedValueOnce([
        { id: "t1", items: [{ id: "i1", imageUrl: "/img/1.webp" }] },
        { id: "t2", items: [{ id: "i2", imageUrl: "/img/2.webp" }] },
      ]);

    const response = await GET(new Request("https://example.test?previewLimit=2"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ id: "t1", items: [{ id: "i1", imageUrl: "/img/1.webp" }] }),
      expect.objectContaining({ id: "t2", items: [{ id: "i2", imageUrl: "/img/2.webp" }] }),
      expect.objectContaining({ id: "t3", items: [] }),
    ]);
    expect(mocks.prisma.template.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: { in: ["t1", "t2"] } },
      }),
    );
  });

  it("creates an owned template and defaults isPublic to false", async () => {
    mocks.prisma.template.create.mockResolvedValue(makeTemplate({ isPublic: false }));

    const response = await POST(
      jsonRequest("POST", "https://example.test", {
        name: "Template",
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ isPublic: false }));
    expect(mocks.prisma.template.create).toHaveBeenCalledWith({
      data: {
        name: "Template",
        description: undefined,
        creatorId: "user_1",
        isPublic: false,
      },
    });
  });
});
