import { describe, expect, it } from "vitest";
import { splitUpdatedMeta } from "@/lib/display-meta";

describe("splitUpdatedMeta", () => {
  it("moves the updated segment into a separate line payload", () => {
    expect(splitUpdatedMeta("19 picks · 7 joined · Updated Mar 3, 2026")).toEqual({
      details: "19 picks · 7 joined",
      updated: "Updated Mar 3, 2026",
    });
  });

  it("leaves metadata untouched when there is no updated segment", () => {
    expect(splitUpdatedMeta("19 picks")).toEqual({
      details: "19 picks",
      updated: null,
    });
  });
});
