// @vitest-environment jsdom

import {
  areVoteBoardDraftsEquivalent,
  buildVoteBoardScopeId,
  createVoteBoardDraftSnapshot,
  getVoteDraftStorageKey,
  LocalVoteDraftStore,
} from "@/lib/vote-draft-storage";
import { ensureLocalStorageApi } from "../../helpers/local-storage";

describe("vote-draft-storage in browser", () => {
  beforeEach(() => {
    ensureLocalStorageApi();
    localStorage.clear();
  });

  it("builds deterministic scope ids", () => {
    expect(buildVoteBoardScopeId({ sessionId: "session_1", participantId: "participant_1" })).toBe(
      "vote-board:session_1:participant_1",
    );
  });

  it("returns null for missing or malformed drafts", () => {
    const store = new LocalVoteDraftStore();
    const context = {
      userId: "user_1",
      scopeId: "vote-board:session_1:participant_1",
      tierKeys: ["S", "A"],
      validItemIds: new Set(["i1", "i2"]),
    };

    expect(store.load(context)).toBeNull();
    localStorage.setItem(getVoteDraftStorageKey(context), "{");
    expect(store.load(context)).toBeNull();
    expect(localStorage.getItem(getVoteDraftStorageKey(context))).toBeNull();
  });

  it("enforces ttl and removes stale drafts", () => {
    const now = 1_000_000;
    const store = new LocalVoteDraftStore({ now: () => now, ttlMs: 1000 });
    const context = {
      userId: "user_1",
      scopeId: "vote-board:session_1:participant_1",
      tierKeys: ["S", "A"],
      validItemIds: new Set(["i1", "i2"]),
    };

    const fresh = createVoteBoardDraftSnapshot({
      updatedAtMs: now - 999,
      tierKeys: context.tierKeys,
      validItemIds: context.validItemIds,
      tiers: { S: ["i1"], A: [] },
      unranked: ["i2"],
    });
    const stale = createVoteBoardDraftSnapshot({
      updatedAtMs: now - 1001,
      tierKeys: context.tierKeys,
      validItemIds: context.validItemIds,
      tiers: { S: ["i1"], A: [] },
      unranked: ["i2"],
    });

    store.save(context, fresh);
    expect(store.load(context)?.tiers.S).toEqual(["i1"]);

    store.save(context, stale);
    expect(store.load(context)).toBeNull();
    expect(localStorage.getItem(getVoteDraftStorageKey(context))).toBeNull();
  });

  it("normalizes malformed payloads and appends missing items", () => {
    const store = new LocalVoteDraftStore();
    const context = {
      userId: "user_1",
      scopeId: "vote-board:session_1:participant_1",
      tierKeys: ["S", "A"],
      validItemIds: new Set(["i1", "i2", "i3", "i4"]),
    };
    localStorage.setItem(
      getVoteDraftStorageKey(context),
      JSON.stringify({
        version: 1,
        updatedAtMs: Date.now(),
        tiers: {
          S: [" i1 ", "missing", "i2"],
          A: ["i1", "i3", "i2"],
          INVALID: ["i4"],
        },
        unranked: ["i3", "i2", "i4", " "],
      }),
    );

    expect(store.load(context)).toEqual({
      version: 1,
      updatedAtMs: expect.any(Number),
      tiers: {
        S: ["i1", "i2"],
        A: ["i3"],
      },
      unranked: ["i4"],
    });
  });

  it("persists and clears drafts and tolerates storage failures", () => {
    const store = new LocalVoteDraftStore();
    const context = {
      userId: "user_1",
      scopeId: "vote-board:session_1:participant_1",
      tierKeys: ["S", "A"],
      validItemIds: new Set(["i1", "i2"]),
    };
    const snapshot = createVoteBoardDraftSnapshot({
      tierKeys: context.tierKeys,
      validItemIds: context.validItemIds,
      tiers: { S: ["i1"], A: [] },
      unranked: ["i2"],
    });
    store.save(context, snapshot);
    expect(store.load(context)?.tiers.S).toEqual(["i1"]);

    const setItemSpy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(() => store.save(context, snapshot)).not.toThrow();
    setItemSpy.mockRestore();

    const removeItemSpy = vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => store.clear(context)).not.toThrow();
    removeItemSpy.mockRestore();
  });

  it("compares snapshots ignoring metadata fields", () => {
    const validItemIds = new Set(["i1", "i2"]);
    const tierKeys = ["S", "A"];
    const left = createVoteBoardDraftSnapshot({
      updatedAtMs: 1,
      tierKeys,
      validItemIds,
      tiers: { S: ["i1"], A: [] },
      unranked: ["i2"],
    });
    const right = createVoteBoardDraftSnapshot({
      updatedAtMs: 99,
      tierKeys,
      validItemIds,
      tiers: { S: ["i1"], A: [] },
      unranked: ["i2"],
    });
    expect(areVoteBoardDraftsEquivalent(left, right, tierKeys)).toBe(true);
  });
});
