const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    session: {
      findUnique: vi.fn(),
    },
    sessionItem: {
      findFirst: vi.fn(),
    },
    templateItem: {
      create: vi.fn(),
    },
  },
  requireSessionOwner: vi.fn(),
  requireOpenSession: vi.fn(),
  tryDeleteManagedUploadIfUnreferenced: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/api-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-helpers")>("@/lib/api-helpers");
  return {
    ...actual,
    requireSessionOwner: mocks.requireSessionOwner,
    requireOpenSession: mocks.requireOpenSession,
  };
});
vi.mock("@/lib/upload-gc", () => ({
  tryDeleteManagedUploadIfUnreferenced: mocks.tryDeleteManagedUploadIfUnreferenced,
}));

import { DELETE } from "@/app/api/sessions/[sessionId]/items/[itemId]/route";
import { POST } from "@/app/api/sessions/[sessionId]/items/route";
import { jsonRequest, routeCtx } from "../../helpers/request";

describe("session item delete route", () => {
  beforeEach(() => {
    mocks.prisma.$transaction.mockReset();
    mocks.prisma.session.findUnique.mockReset().mockResolvedValue({
      templateId: "template_1",
      template: { isHidden: true },
    });
    mocks.prisma.sessionItem.findFirst.mockReset();
    mocks.prisma.templateItem.create.mockReset();
    mocks.requireSessionOwner.mockReset().mockResolvedValue(undefined);
    mocks.requireOpenSession.mockReset().mockResolvedValue({ id: "session_1", status: "OPEN" });
    mocks.tryDeleteManagedUploadIfUnreferenced.mockReset().mockResolvedValue(true);
  });

  it("creates live items only for hidden-working-template sessions", async () => {
    const tx = {
      sessionItem: {
        findFirst: vi.fn().mockResolvedValue({ sortOrder: 2 }),
        create: vi.fn().mockResolvedValue({
          id: "item_3",
          label: "New item",
          imageUrl: "/img/3.webp",
          sortOrder: 3,
        }),
      },
      templateItem: {
        create: vi.fn().mockResolvedValue({ id: "template_item_3" }),
      },
    };
    mocks.prisma.$transaction.mockImplementation(
      async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    );

    let response = await POST(
      jsonRequest("POST", "https://example.test", { label: "New item", imageUrl: "/img/3.webp" }),
      routeCtx({ sessionId: "session_1" }),
    );

    expect(response.status).toBe(201);
    expect(tx.templateItem.create).toHaveBeenCalledWith({
      data: {
        templateId: "template_1",
        label: "New item",
        imageUrl: "/img/3.webp",
        sortOrder: 3,
      },
    });

    mocks.prisma.session.findUnique.mockResolvedValueOnce({
      templateId: "template_legacy",
      template: { isHidden: false },
    });

    response = await POST(
      jsonRequest("POST", "https://example.test", { label: "New item", imageUrl: "/img/3.webp" }),
      routeCtx({ sessionId: "session_1" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "This session must be recreated before live item editing is available",
    });
  });

  it("deletes removable session items and their backing template item", async () => {
    mocks.prisma.sessionItem.findFirst.mockResolvedValue({
      id: "item_1",
      imageUrl: "/img/1.webp",
      templateItemId: "template_item_1",
      _count: {
        tierVotes: 0,
        bracketVotesAsItemA: 0,
        bracketVotesAsItemB: 0,
        bracketWins: 0,
        bracketVoteChoices: 0,
      },
    });
    const tx = {
      sessionItem: { delete: vi.fn().mockResolvedValue(undefined) },
      templateItem: { delete: vi.fn().mockResolvedValue(undefined) },
    };
    mocks.prisma.$transaction.mockImplementation(async (fn: (client: typeof tx) => Promise<void>) =>
      fn(tx),
    );

    const response = await DELETE(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ sessionId: "session_1", itemId: "item_1" }),
    );

    expect(response.status).toBe(204);
    expect(tx.sessionItem.delete).toHaveBeenCalledWith({ where: { id: "item_1" } });
    expect(tx.templateItem.delete).toHaveBeenCalledWith({ where: { id: "template_item_1" } });
    expect(mocks.tryDeleteManagedUploadIfUnreferenced).toHaveBeenCalledWith(
      "/img/1.webp",
      "session item delete",
    );
  });

  it("rejects deleting items from legacy sessions without a hidden working template", async () => {
    mocks.prisma.session.findUnique.mockResolvedValueOnce({
      template: { isHidden: false },
    });

    const response = await DELETE(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ sessionId: "session_1", itemId: "item_1" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "This session must be recreated before live item editing is available",
    });
  });

  it("rejects deleting items that already have saved references", async () => {
    mocks.prisma.sessionItem.findFirst.mockResolvedValue({
      id: "item_1",
      imageUrl: "/img/1.webp",
      templateItemId: "template_item_1",
      _count: {
        tierVotes: 1,
        bracketVotesAsItemA: 0,
        bracketVotesAsItemB: 0,
        bracketWins: 0,
        bracketVoteChoices: 0,
      },
    });

    const response = await DELETE(
      new Request("https://example.test", { method: "DELETE" }),
      routeCtx({ sessionId: "session_1", itemId: "item_1" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "This item already has saved votes and cannot be removed",
    });
  });
});
