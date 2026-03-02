const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    template: {
      findUnique: vi.fn(),
    },
    templateItem: {
      findFirst: vi.fn(),
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

import { POST as addItem } from "@/app/api/templates/[templateId]/items/route";
import { DELETE, PATCH } from "@/app/api/templates/[templateId]/items/[itemId]/route";
import { jsonRequest, routeCtx } from "../../helpers/request";

describe("template item routes", () => {
  beforeEach(() => {
    mocks.prisma.$transaction.mockReset();
    mocks.prisma.template.findUnique.mockReset();
    mocks.prisma.templateItem.findFirst.mockReset();
    mocks.prisma.templateItem.update.mockReset();
    mocks.prisma.templateItem.delete.mockReset();
    mocks.getRequestAuth.mockReset().mockResolvedValue({ userId: "user_1" });
    mocks.tryDeleteManagedUploadIfUnreferenced.mockReset().mockResolvedValue(true);
  });

  it("adds a template item with automatic sort order", async () => {
    mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        template: {
          findUnique: vi.fn().mockResolvedValue({ id: "t1", creatorId: "user_1" }),
        },
        templateItem: {
          findFirst: vi.fn().mockResolvedValue({ sortOrder: 4 }),
          create: vi.fn().mockResolvedValue({
            id: "item_1",
            label: "Item 1",
            imageUrl: "/1.webp",
            sortOrder: 5,
            templateId: "t1",
          }),
        },
      }),
    );

    const response = await addItem(
      jsonRequest("POST", "https://example.test", {
        label: "Item 1",
        imageUrl: "/1.webp",
      }),
      routeCtx({ templateId: "t1" }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ sortOrder: 5, templateId: "t1" }),
    );
  });

  it("updates and deletes template items, cleaning replaced images", async () => {
    mocks.prisma.template.findUnique.mockResolvedValue({ creatorId: "user_1" });
    mocks.prisma.templateItem.findFirst
      .mockResolvedValueOnce({ id: "item_1", imageUrl: "/old.webp" })
      .mockResolvedValueOnce({ id: "item_1", imageUrl: "/new.webp" });
    mocks.prisma.templateItem.update.mockResolvedValue({
      id: "item_1",
      imageUrl: "/new.webp",
    });

    let response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { imageUrl: "/new.webp" }),
      routeCtx({ templateId: "t1", itemId: "item_1" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ imageUrl: "/new.webp" }),
    );
    expect(mocks.tryDeleteManagedUploadIfUnreferenced).toHaveBeenCalledWith(
      "/old.webp",
      "template item image update",
    );

    response = await DELETE(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ templateId: "t1", itemId: "item_1" }),
    );
    expect(response.status).toBe(204);
    expect(mocks.prisma.templateItem.delete).toHaveBeenCalledWith({ where: { id: "item_1" } });
    expect(mocks.tryDeleteManagedUploadIfUnreferenced).toHaveBeenCalledWith(
      "/new.webp",
      "template item delete",
    );
  });
});
