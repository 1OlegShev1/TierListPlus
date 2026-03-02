import { clearDraft, getDraft, saveDraft } from "@/lib/vote-draft";

describe("vote-draft on the server", () => {
  it("no-ops without window", () => {
    expect(getDraft("s1", "p1", new Set(["i1"]))).toBeNull();
    expect(() => saveDraft("s1", "p1", { tiers: {}, unranked: [] })).not.toThrow();
    expect(() => clearDraft("s1", "p1")).not.toThrow();
  });
});
