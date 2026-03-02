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
    await expect(response.json()).resolves.toEqual([expect.objectContaining({ isPublic: true })]);
    expect(mocks.prisma.template.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublic: true, isHidden: false } }),
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
