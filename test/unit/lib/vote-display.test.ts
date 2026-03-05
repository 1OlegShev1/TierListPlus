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
    expect(display.detailsLabel).toBe("19 picks · 7 joined");
    expect(display.secondaryLabel).toContain("Updated");
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
    expect(display.detailsLabel).toBe("5 picks · 2 joined");
    expect(display.secondaryLabel).toContain("Updated");
  });

  it("shows space-aware visibility chips for space-scoped votes", () => {
    const openSpaceDisplay = buildVoteDisplay({
      viewer: "browser",
      isPrivate: true,
      isLocked: false,
      status: "OPEN",
      updatedAt: "2026-03-03T12:00:00.000Z",
      itemCount: 8,
      participantCount: 3,
      listName: "Anime",
      listHidden: false,
      spaceVisibility: "OPEN",
    });
    const privateSpaceDisplay = buildVoteDisplay({
      viewer: "browser",
      isPrivate: true,
      isLocked: false,
      status: "OPEN",
      updatedAt: "2026-03-03T12:00:00.000Z",
      itemCount: 8,
      participantCount: 3,
      listName: "Team picks",
      listHidden: false,
      spaceVisibility: "PRIVATE",
    });

    expect(openSpaceDisplay.chips.some((chip) => chip.label === "Open space")).toBe(true);
    expect(privateSpaceDisplay.chips.some((chip) => chip.label === "Private space")).toBe(true);
    expect(openSpaceDisplay.chips.find((chip) => chip.label === "Open space")?.tone).toBe(
      "public",
    );
    expect(privateSpaceDisplay.chips.find((chip) => chip.label === "Private space")?.tone).toBe(
      "private",
    );
  });

  it("supports access label override for space pages", () => {
    const display = buildVoteDisplay({
      viewer: "browser",
      isPrivate: true,
      isLocked: false,
      status: "OPEN",
      updatedAt: "2026-03-03T12:00:00.000Z",
      itemCount: 8,
      participantCount: 3,
      listName: "Anime",
      listHidden: false,
      spaceVisibility: "OPEN",
      accessLabel: "Space",
    });

    expect(display.chips.some((chip) => chip.label === "Space")).toBe(true);
    expect(display.chips.some((chip) => chip.label === "Open space")).toBe(false);
  });
});
