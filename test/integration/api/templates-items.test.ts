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
    const createTemplateItem = vi.fn().mockResolvedValue({
      id: "item_1",
      label: "Item 1",
      imageUrl: "/1.webp",
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      sourceProvider: "YOUTUBE",
      sourceNote: "Live version",
      sortOrder: 5,
      templateId: "t1",
    });
    mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        template: {
          findUnique: vi.fn().mockResolvedValue({ id: "t1", creatorId: "user_1" }),
        },
        templateItem: {
          findFirst: vi.fn().mockResolvedValue({ sortOrder: 4 }),
          create: createTemplateItem,
        },
      }),
    );

    const response = await addItem(
      jsonRequest("POST", "https://example.test", {
        label: "Item 1",
        imageUrl: "/1.webp",
        sourceUrl: "https://youtu.be/dQw4w9WgXcQ?t=12",
        sourceNote: "Live version",
      }),
      routeCtx({ templateId: "t1" }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ sortOrder: 5, templateId: "t1" }),
    );
    expect(createTemplateItem).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        sourceProvider: "YOUTUBE",
        sourceNote: "Live version",
      }),
    });
  });

  it("accepts generic external source providers", async () => {
    const createTemplateItem = vi.fn().mockResolvedValue({
      id: "item_1",
      label: "Item 1",
      imageUrl: "/1.webp",
      sourceUrl: "https://example.com/song",
      sourceProvider: null,
      sourceNote: null,
      sortOrder: 0,
      templateId: "t1",
    });
    mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        template: {
          findUnique: vi.fn().mockResolvedValue({ id: "t1", creatorId: "user_1" }),
        },
        templateItem: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: createTemplateItem,
        },
      }),
    );

    const response = await addItem(
      jsonRequest("POST", "https://example.test", {
        label: "Item 1",
        imageUrl: "/1.webp",
        sourceUrl: "https://example.com/song",
      }),
      routeCtx({ templateId: "t1" }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        sourceUrl: "https://example.com/song",
        sourceProvider: null,
      }),
    );
    expect(createTemplateItem).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceUrl: "https://example.com/song",
        sourceProvider: null,
      }),
    });
  });

  it("rejects non-YouTube interval payloads on create", async () => {
    mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        template: {
          findUnique: vi.fn().mockResolvedValue({ id: "t1", creatorId: "user_1" }),
        },
        templateItem: {
          findFirst: vi.fn(),
          create: vi.fn(),
        },
      }),
    );

    const response = await addItem(
      jsonRequest("POST", "https://example.test", {
        label: "Item 1",
        imageUrl: "/1.webp",
        sourceUrl: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
        sourceStartSec: 30,
      }),
      routeCtx({ templateId: "t1" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Source intervals are only supported for YouTube links.",
    });
  });

  it("updates and deletes template items, cleaning replaced images", async () => {
    mocks.prisma.template.findUnique.mockResolvedValue({ creatorId: "user_1" });
    mocks.prisma.templateItem.findFirst
      .mockResolvedValueOnce({ id: "item_1", imageUrl: "/old.webp", sourceUrl: null })
      .mockResolvedValueOnce({ id: "item_1", imageUrl: "/new.webp", sourceUrl: null });
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

  it("clears source note when item has no source URL", async () => {
    mocks.prisma.template.findUnique.mockResolvedValue({ creatorId: "user_1" });
    mocks.prisma.templateItem.findFirst.mockResolvedValue({
      id: "item_1",
      imageUrl: "/old.webp",
      sourceUrl: null,
    });
    mocks.prisma.templateItem.update.mockResolvedValue({
      id: "item_1",
      sourceUrl: null,
      sourceProvider: null,
      sourceNote: null,
    });

    const response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { sourceNote: "orphan note" }),
      routeCtx({ templateId: "t1", itemId: "item_1" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.prisma.templateItem.update).toHaveBeenCalledWith({
      where: { id: "item_1", templateId: "t1" },
      data: { sourceNote: null, sourceStartSec: null, sourceEndSec: null },
    });
  });

  it("rejects invalid partial YouTube interval updates", async () => {
    mocks.prisma.template.findUnique.mockResolvedValue({ creatorId: "user_1" });
    mocks.prisma.templateItem.findFirst.mockResolvedValue({
      id: "item_1",
      imageUrl: "/old.webp",
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      sourceProvider: "YOUTUBE",
      sourceStartSec: 120,
      sourceEndSec: 180,
    });

    const response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { sourceEndSec: 30 }),
      routeCtx({ templateId: "t1", itemId: "item_1" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "End time must be greater than start time.",
    });
    expect(mocks.prisma.templateItem.update).not.toHaveBeenCalled();
  });

  it("rejects non-YouTube interval payloads on patch", async () => {
    mocks.prisma.template.findUnique.mockResolvedValue({ creatorId: "user_1" });
    mocks.prisma.templateItem.findFirst.mockResolvedValue({
      id: "item_1",
      imageUrl: "/old.webp",
      sourceUrl: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
      sourceProvider: "SPOTIFY",
      sourceStartSec: null,
      sourceEndSec: null,
    });

    const response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { sourceEndSec: 90 }),
      routeCtx({ templateId: "t1", itemId: "item_1" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Source intervals are only supported for YouTube links.",
    });
    expect(mocks.prisma.templateItem.update).not.toHaveBeenCalled();
  });

  it("rejects template item updates with no changes", async () => {
    mocks.prisma.template.findUnique.mockResolvedValue({ creatorId: "user_1" });
    mocks.prisma.templateItem.findFirst.mockResolvedValue({
      id: "item_1",
      imageUrl: "/old.webp",
      sourceUrl: null,
      sourceProvider: null,
      sourceStartSec: null,
      sourceEndSec: null,
    });

    const response = await PATCH(
      jsonRequest("PATCH", "https://example.test", {}),
      routeCtx({ templateId: "t1", itemId: "item_1" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "No item changes provided",
    });
    expect(mocks.prisma.templateItem.update).not.toHaveBeenCalled();
  });

  it("does not crash for anonymous space checks when members are not selected", async () => {
    mocks.getRequestAuth.mockResolvedValue(null);
    mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        template: {
          findUnique: vi.fn().mockResolvedValue({
            id: "t1",
            creatorId: "user_owner",
            spaceId: "space_1",
            space: { creatorId: "user_owner" },
          }),
        },
        templateItem: {
          findFirst: vi.fn(),
          create: vi.fn(),
        },
      }),
    );

    const response = await addItem(
      jsonRequest("POST", "https://example.test", { label: "Item 1", imageUrl: "/1.webp" }),
      routeCtx({ templateId: "t1" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "You are not allowed to edit this list",
    });
  });

  it("returns forbidden (not 500) when anonymous user patches a space template item", async () => {
    mocks.getRequestAuth.mockResolvedValue(null);
    mocks.prisma.template.findUnique.mockResolvedValue({
      creatorId: "user_owner",
      spaceId: "space_1",
      space: { creatorId: "user_owner" },
    });

    const response = await PATCH(
      jsonRequest("PATCH", "https://example.test", { label: "New label" }),
      routeCtx({ templateId: "t1", itemId: "item_1" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "You are not allowed to edit this list",
    });
    expect(mocks.prisma.templateItem.findFirst).not.toHaveBeenCalled();
  });
});
