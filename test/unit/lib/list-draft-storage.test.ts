// @vitest-environment jsdom

import {
  areListEditorDraftsEquivalent,
  buildListEditorScopeId,
  createListEditorDraftSnapshot,
  getListDraftStorageKey,
  LocalListDraftStore,
} from "@/lib/list-draft-storage";
import { ensureLocalStorageApi } from "../../helpers/local-storage";

describe("list-draft-storage in browser", () => {
  beforeEach(() => {
    ensureLocalStorageApi();
    localStorage.clear();
  });

  it("builds deterministic scope ids", () => {
    expect(buildListEditorScopeId({})).toBe("list-editor:create:personal");
    expect(buildListEditorScopeId({ spaceId: "space_1" })).toBe("list-editor:create:space:space_1");
    expect(buildListEditorScopeId({ listId: "tpl_1", spaceId: "space_1" })).toBe(
      "list-editor:edit:tpl_1",
    );
  });

  it("returns null for missing or malformed drafts", () => {
    const store = new LocalListDraftStore();
    const context = { userId: "user_1", scopeId: "list-editor:create:personal" };
    expect(store.load(context)).toBeNull();

    localStorage.setItem(getListDraftStorageKey(context), "{");
    expect(store.load(context)).toBeNull();
    expect(localStorage.getItem(getListDraftStorageKey(context))).toBeNull();
  });

  it("enforces ttl and removes stale drafts", () => {
    const now = 1_000_000;
    const store = new LocalListDraftStore({ now: () => now, ttlMs: 1000 });
    const context = { userId: "user_1", scopeId: "list-editor:create:personal" };

    const fresh = createListEditorDraftSnapshot({
      updatedAtMs: now - 999,
      name: "Fresh",
      description: "",
      isPublic: false,
      items: [],
    });
    const stale = createListEditorDraftSnapshot({
      updatedAtMs: now - 1001,
      name: "Stale",
      description: "",
      isPublic: false,
      items: [],
    });

    store.save(context, fresh);
    expect(store.load(context)?.name).toBe("Fresh");

    store.save(context, stale);
    expect(store.load(context)).toBeNull();
    expect(localStorage.getItem(getListDraftStorageKey(context))).toBeNull();
  });

  it("normalizes malformed draft payloads", () => {
    const store = new LocalListDraftStore();
    const context = { userId: "user_1", scopeId: "list-editor:create:personal" };
    localStorage.setItem(
      getListDraftStorageKey(context),
      JSON.stringify({
        version: 1,
        updatedAtMs: Date.now(),
        name: "x".repeat(120),
        description: "d".repeat(700),
        isPublic: "yes",
        items: [
          {
            id: " item_1 ",
            label: "  One   Label ",
            imageUrl: " https://img.test/1.webp ",
            sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            sourceProvider: "NOPE",
            sourceNote: "   keep note   ",
            sourceStartSec: 12.9,
            sourceEndSec: 66.1,
          },
          {
            label: "invalid no image",
          },
        ],
      }),
    );

    const loaded = store.load(context);
    expect(loaded).not.toBeNull();
    expect(loaded?.name.length).toBe(100);
    expect(loaded?.description.length).toBe(500);
    expect(loaded?.isPublic).toBe(false);
    expect(loaded?.items).toHaveLength(1);
    expect(loaded?.items[0]).toEqual(
      expect.objectContaining({
        id: "item_1",
        label: "One Label",
        imageUrl: "https://img.test/1.webp",
        sourceProvider: "YOUTUBE",
        sourceStartSec: 12,
        sourceEndSec: 66,
        sortOrder: 0,
      }),
    );
  });

  it("persists and clears drafts and tolerates storage failures", () => {
    const store = new LocalListDraftStore();
    const context = { userId: "user_1", scopeId: "list-editor:create:personal" };
    const snapshot = createListEditorDraftSnapshot({
      name: "Draft",
      description: "desc",
      isPublic: true,
      items: [],
    });
    store.save(context, snapshot);
    expect(store.load(context)?.name).toBe("Draft");

    const setItemSpy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("storage full");
    });
    expect(() => store.save(context, snapshot)).not.toThrow();
    setItemSpy.mockRestore();

    const removeItemSpy = vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => store.clear(context)).not.toThrow();
    removeItemSpy.mockRestore();
  });

  it("compares snapshots ignoring metadata", () => {
    const a = createListEditorDraftSnapshot({
      updatedAtMs: 1,
      name: "Name",
      description: "Desc",
      isPublic: false,
      items: [{ label: "A", imageUrl: "/a.webp", sortOrder: 0 }],
    });
    const b = createListEditorDraftSnapshot({
      updatedAtMs: 99,
      name: "Name",
      description: "Desc",
      isPublic: false,
      items: [{ label: "A", imageUrl: "/a.webp", sortOrder: 0 }],
    });
    expect(areListEditorDraftsEquivalent(a, b)).toBe(true);
  });
});
