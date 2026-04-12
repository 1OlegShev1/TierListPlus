const mocks = vi.hoisted(() => ({
  prisma: {
    draft: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  requireRequestAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({
  requireRequestAuth: mocks.requireRequestAuth,
}));

import { DELETE, GET, PUT } from "@/app/api/drafts/route";
import { jsonRequest } from "../../helpers/request";

describe("drafts api route", () => {
  beforeEach(() => {
    mocks.prisma.draft.findUnique.mockReset();
    mocks.prisma.draft.upsert.mockReset();
    mocks.prisma.draft.deleteMany.mockReset();
    mocks.requireRequestAuth.mockReset().mockResolvedValue({
      userId: "user_1",
      deviceId: "device_1",
    });
  });

  it("returns draft snapshot on GET", async () => {
    mocks.prisma.draft.findUnique.mockResolvedValue({
      kind: "LIST_EDITOR",
      scope: "list-editor:create:personal",
      payload: {
        version: 1,
        updatedAtMs: 1,
        name: "x",
        description: "",
        isPublic: false,
        items: [],
      },
      updatedAt: new Date("2026-04-11T10:00:00.000Z"),
    });

    const response = await GET(
      new Request(
        "https://example.test/api/drafts?kind=LIST_EDITOR&scope=list-editor:create:personal",
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      kind: "LIST_EDITOR",
      scope: "list-editor:create:personal",
      payload: {
        version: 1,
        updatedAtMs: 1,
        name: "x",
        description: "",
        isPublic: false,
        items: [],
      },
      updatedAtMs: new Date("2026-04-11T10:00:00.000Z").getTime(),
    });
    expect(mocks.prisma.draft.findUnique).toHaveBeenCalledWith({
      where: {
        userId_kind_scope: {
          userId: "user_1",
          kind: "LIST_EDITOR",
          scope: "list-editor:create:personal",
        },
      },
      select: {
        kind: true,
        scope: true,
        payload: true,
        updatedAt: true,
      },
    });
  });

  it("returns 404 for missing draft on GET", async () => {
    mocks.prisma.draft.findUnique.mockResolvedValue(null);

    const response = await GET(
      new Request(
        "https://example.test/api/drafts?kind=LIST_EDITOR&scope=list-editor:create:personal",
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Draft not found" });
  });

  it("upserts draft payload on PUT", async () => {
    mocks.prisma.draft.upsert.mockResolvedValue({
      kind: "LIST_EDITOR",
      scope: "list-editor:edit:tpl_1",
      payload: {
        version: 1,
        updatedAtMs: 2,
        name: "Edited",
        description: "",
        isPublic: true,
        items: [],
      },
      updatedAt: new Date("2026-04-11T11:00:00.000Z"),
    });

    const response = await PUT(
      jsonRequest("PUT", "https://example.test/api/drafts", {
        kind: "LIST_EDITOR",
        scope: "list-editor:edit:tpl_1",
        payload: {
          version: 1,
          updatedAtMs: 2,
          name: "Edited",
          description: "",
          isPublic: true,
          items: [],
        },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      kind: "LIST_EDITOR",
      scope: "list-editor:edit:tpl_1",
      payload: {
        version: 1,
        updatedAtMs: 2,
        name: "Edited",
        description: "",
        isPublic: true,
        items: [],
      },
      updatedAtMs: new Date("2026-04-11T11:00:00.000Z").getTime(),
    });

    expect(mocks.prisma.draft.upsert).toHaveBeenCalledWith({
      where: {
        userId_kind_scope: {
          userId: "user_1",
          kind: "LIST_EDITOR",
          scope: "list-editor:edit:tpl_1",
        },
      },
      update: {
        payload: {
          version: 1,
          updatedAtMs: 2,
          name: "Edited",
          description: "",
          isPublic: true,
          items: [],
        },
        deviceId: "device_1",
      },
      create: {
        userId: "user_1",
        deviceId: "device_1",
        kind: "LIST_EDITOR",
        scope: "list-editor:edit:tpl_1",
        payload: {
          version: 1,
          updatedAtMs: 2,
          name: "Edited",
          description: "",
          isPublic: true,
          items: [],
        },
      },
      select: {
        kind: true,
        scope: true,
        payload: true,
        updatedAt: true,
      },
    });
  });

  it("accepts vote board payload on PUT", async () => {
    mocks.prisma.draft.upsert.mockResolvedValue({
      kind: "VOTE_BOARD",
      scope: "vote-board:session_1:participant_1",
      payload: {
        version: 1,
        updatedAtMs: 3,
        tiers: { S: ["item_1"], A: [] },
        unranked: ["item_2"],
      },
      updatedAt: new Date("2026-04-11T11:30:00.000Z"),
    });

    const response = await PUT(
      jsonRequest("PUT", "https://example.test/api/drafts", {
        kind: "VOTE_BOARD",
        scope: "vote-board:session_1:participant_1",
        payload: {
          version: 1,
          updatedAtMs: 3,
          tiers: { S: ["item_1"], A: [] },
          unranked: ["item_2"],
        },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      kind: "VOTE_BOARD",
      scope: "vote-board:session_1:participant_1",
      payload: {
        version: 1,
        updatedAtMs: 3,
        tiers: { S: ["item_1"], A: [] },
        unranked: ["item_2"],
      },
      updatedAtMs: new Date("2026-04-11T11:30:00.000Z").getTime(),
    });
  });

  it("deletes matching draft on DELETE", async () => {
    mocks.prisma.draft.deleteMany.mockResolvedValue({ count: 1 });

    const response = await DELETE(
      new Request(
        "https://example.test/api/drafts?kind=LIST_EDITOR&scope=list-editor:create:personal",
        {
          method: "DELETE",
        },
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(204);
    expect(mocks.prisma.draft.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        kind: "LIST_EDITOR",
        scope: "list-editor:create:personal",
      },
    });
  });

  it("rejects invalid payload for kind on PUT", async () => {
    const response = await PUT(
      jsonRequest("PUT", "https://example.test/api/drafts", {
        kind: "LIST_EDITOR",
        scope: "list-editor:create:personal",
        payload: {},
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Payload is invalid for the requested draft kind",
    });
    expect(mocks.prisma.draft.upsert).not.toHaveBeenCalled();
  });

  it("rejects vote payload with duplicate item IDs on PUT", async () => {
    const response = await PUT(
      jsonRequest("PUT", "https://example.test/api/drafts", {
        kind: "VOTE_BOARD",
        scope: "vote-board:session_1:participant_1",
        payload: {
          version: 1,
          updatedAtMs: 3,
          tiers: { S: ["item_1"], A: [] },
          unranked: ["item_1"],
        },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Payload is invalid for the requested draft kind",
    });
    expect(mocks.prisma.draft.upsert).not.toHaveBeenCalled();
  });

  it("rejects oversized payload on PUT", async () => {
    const itemBlob = "a".repeat(700);
    const response = await PUT(
      jsonRequest("PUT", "https://example.test/api/drafts", {
        kind: "LIST_EDITOR",
        scope: "list-editor:create:personal",
        payload: {
          version: 1,
          updatedAtMs: 2,
          name: "Big draft",
          description: "",
          isPublic: false,
          items: Array.from({ length: 500 }, (_, index) => ({
            label: `Item ${index}`,
            imageUrl: `/img/${itemBlob}${index}.webp`,
            sortOrder: index,
          })),
        },
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Draft payload is too large" });
    expect(mocks.prisma.draft.upsert).not.toHaveBeenCalled();
  });

  it("validates query parameters", async () => {
    const response = await GET(new Request("https://example.test/api/drafts"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Query requires valid kind and scope",
    });
  });
});
