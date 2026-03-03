import { describe, expect, it } from "vitest";
import { buildVoteDisplay } from "@/lib/vote-display";

describe("buildVoteDisplay", () => {
  it("separates the source list from the stats for visible lists", () => {
    const display = buildVoteDisplay({
      viewer: "participant",
      isPrivate: false,
      isLocked: false,
      status: "OPEN",
      updatedAt: "2026-03-03T12:00:00.000Z",
      itemCount: 19,
      participantCount: 7,
      listName: "Programming languages",
      listHidden: false,
    });

    expect(display.sourceLabel).toBe("Programming languages");
    expect(display.meta).toContain("19 picks");
    expect(display.meta).toContain("7 joined");
    expect(display.meta).toContain("Updated");
  });

  it("hides the source list when the template name should stay hidden", () => {
    const display = buildVoteDisplay({
      viewer: "browser",
      isPrivate: true,
      isLocked: true,
      status: "OPEN",
      updatedAt: "2026-03-03T12:00:00.000Z",
      itemCount: 5,
      participantCount: 2,
      listName: "Secret list",
      listHidden: true,
    });

    expect(display.sourceLabel).toBeNull();
    expect(display.meta).not.toContain("Secret list");
  });
});
