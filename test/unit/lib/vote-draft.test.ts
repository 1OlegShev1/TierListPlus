// @vitest-environment jsdom

import { clearDraft, getDraft, saveDraft } from "@/lib/vote-draft";
import { ensureLocalStorageApi } from "../../helpers/local-storage";

describe("vote-draft in the browser", () => {
  beforeEach(() => {
    ensureLocalStorageApi();
    localStorage.removeItem("tierlistplus_draft_s1_p1");
    localStorage.removeItem("tierlistplus_draft_s2_p2");
  });

  it("returns null for missing or malformed drafts", () => {
    expect(getDraft("s1", "p1", new Set(["i1"]))).toBeNull();
    localStorage.setItem("tierlistplus_draft_s1_p1", "{");
    expect(getDraft("s1", "p1", new Set(["i1"]))).toBeNull();
  });

  it("filters invalid ids and ignores drafts without ranked items", () => {
    saveDraft("s1", "p1", {
      tiers: { S: ["i1", "missing"] },
      unranked: ["i2", "missing"],
    });

    expect(getDraft("s1", "p1", new Set(["i1", "i2"]))).toEqual({
      tiers: { S: ["i1"] },
      unranked: ["i2"],
    });

    saveDraft("s2", "p2", {
      tiers: { S: ["missing"] },
      unranked: ["i2"],
    });
    expect(getDraft("s2", "p2", new Set(["i2"]))).toBeNull();
  });

  it("persists and clears drafts and tolerates storage failures", () => {
    saveDraft("s1", "p1", { tiers: { S: ["i1"] }, unranked: [] });
    expect(localStorage.getItem("tierlistplus_draft_s1_p1")).toContain("i1");

    const setItemSpy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(() => saveDraft("s1", "p1", { tiers: {}, unranked: [] })).not.toThrow();
    setItemSpy.mockRestore();

    clearDraft("s1", "p1");
    expect(localStorage.getItem("tierlistplus_draft_s1_p1")).toBeNull();
  });
});
