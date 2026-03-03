import { describe, expect, it } from "vitest";
import { buildListDisplay } from "@/lib/list-display";

describe("buildListDisplay", () => {
  it("describes an owned private list", () => {
    const display = buildListDisplay({
      viewer: "owner",
      isPublic: false,
      updatedAt: "2026-03-03T12:00:00.000Z",
      itemCount: 19,
    });

    expect(display.chips).toEqual([
      { label: "Your list", tone: "accent" },
      { label: "Private", tone: "neutral" },
    ]);
    expect(display.detailsLabel).toBe("19 picks");
    expect(display.secondaryLabel).toContain("Updated");
  });

  it("describes a shared public list", () => {
    const display = buildListDisplay({
      viewer: "browser",
      isPublic: true,
      updatedAt: "2026-03-02T12:00:00.000Z",
      itemCount: 10,
    });

    expect(display.chips).toEqual([
      { label: "Shared list", tone: "accent" },
      { label: "Public", tone: "neutral" },
    ]);
    expect(display.detailsLabel).toBe("10 picks");
    expect(display.secondaryLabel).toContain("Updated");
  });
});
