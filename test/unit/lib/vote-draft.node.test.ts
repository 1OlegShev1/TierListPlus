import { createVoteBoardDraftSnapshot, LocalVoteDraftStore } from "@/lib/vote-draft-storage";

describe("vote-draft-storage on server", () => {
  it("no-ops without window", () => {
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

    expect(store.load(context)).toBeNull();
    expect(() => store.save(context, snapshot)).not.toThrow();
    expect(() => store.clear(context)).not.toThrow();
  });
});
