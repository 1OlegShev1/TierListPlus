const mocks = vi.hoisted(() => ({
  prisma: {
    template: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
  getRequestAuth: vi.fn(),
  tryDeleteManagedUploadIfUnreferenced: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  getRequestAuth: mocks.getRequestAuth,
}));
vi.mock("@/lib/upload-gc", () => ({
  tryDeleteManagedUploadIfUnreferenced: mocks.tryDeleteManagedUploadIfUnreferenced,
}));

import { DELETE, GET, PATCH } from "@/app/api/templates/[templateId]/route";
import { makeTemplate } from "../../helpers/mocks";
import { jsonRequest, routeCtx } from "../../helpers/request";

describe("template detail route", () => {
  beforeEach(() => {
    mocks.prisma.template.findUnique.mockReset();
    mocks.prisma.template.update.mockReset();
    mocks.prisma.template.delete.mockReset();
    mocks.getRequestAuth.mockReset().mockResolvedValue(null);
    mocks.tryDeleteManagedUploadIfUnreferenced.mockReset().mockResolvedValue(true);
  });

  it("returns not found for inaccessible templates and returns accessible templates", async () => {
    mocks.prisma.template.findUnique
      .mockResolvedValueOnce(makeTemplate({ creatorId: "user_1", isPublic: false }))
      .mockResolvedValueOnce(makeTemplate({ isPublic: true, items: [] }));

    let response = await GET(new Request("https://example.test"), routeCtx({ templateId: "t1" }));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Template not found" });

    response = await GET(new Request("https://example.test"), routeCtx({ templateId: "t1" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ id: "template_1" }));
  });

  it("patches owned templates and enforces delete constraints", async () => {
    mocks.getRequestAuth.mockResolvedValue({ userId: "user_1" });
    mocks.prisma.template.findUnique
      .mockResolvedValueOnce({ id: "t1", creatorId: "user_1" })
      .mockResolvedValueOnce({
        id: "t1",
        creatorId: "user_1",
        items: [{ imageUrl: "/1.webp" }, { imageUrl: "/2.webp" }],
        _count: { sessions: 2 },
      })
      .mockResolvedValueOnce({
        id: "t1",
        creatorId: "user_1",
        items: [{ imageUrl: "/1.webp" }, { imageUrl: "/1.webp" }],
        _count: { sessions: 0 },
      });
    mocks.prisma.template.update.mockResolvedValue(
      makeTemplate({ id: "t1", name: "Renamed", creatorId: "user_1" }),
    );

    let response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { name: "Renamed" }),
      routeCtx({ templateId: "t1" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ name: "Renamed" }));

    response = await DELETE(new Request("https://example.test", { method: "DELETE" }), routeCtx({ templateId: "t1" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Cannot delete: 2 session(s) use this template. Delete those sessions first.",
    });

    response = await DELETE(new Request("https://example.test", { method: "DELETE" }), routeCtx({ templateId: "t1" }));
    expect(response.status).toBe(204);
    expect(mocks.prisma.template.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
    expect(mocks.tryDeleteManagedUploadIfUnreferenced).toHaveBeenCalledTimes(1);
  });
});
