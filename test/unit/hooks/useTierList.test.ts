import { useTierListStore } from "@/hooks/useTierList";
import type { Item } from "@/types";

const items: Item[] = [
  { id: "i1", label: "One", imageUrl: "/1" },
  { id: "i2", label: "Two", imageUrl: "/2" },
  { id: "i3", label: "Three", imageUrl: "/3" },
];

function resetStore() {
  useTierListStore.setState({
    tiers: {},
    unranked: [],
    items: new Map(),
    activeId: null,
  });
}

describe("useTierListStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("initializes from items, seeded tiers, and drafts", () => {
    useTierListStore.getState().initialize(items, ["S", "A"], { S: ["i1"] });
    expect(useTierListStore.getState().tiers).toEqual({ S: ["i1"], A: [] });
    expect(useTierListStore.getState().unranked).toEqual(["i2", "i3"]);

    resetStore();
    useTierListStore.getState().initialize(
      items,
      ["S", "A"],
      { S: ["i1"] },
      { tiers: { Z: ["i2"], S: ["i3"] }, unranked: ["i1"] },
    );

    expect(useTierListStore.getState().tiers).toEqual({ S: ["i3"], A: [] });
    expect(useTierListStore.getState().unranked).toEqual(["i1", "i2"]);
  });

  it("moves, reorders, and emits votes", () => {
    useTierListStore.getState().initialize(items, ["S", "A"], { S: ["i1"] });

    expect(useTierListStore.getState().findContainer("i1")).toBe("S");
    expect(useTierListStore.getState().findContainer("i2")).toBe("unranked");

    useTierListStore.getState().moveItem("i2", "A", 0);
    useTierListStore.getState().moveItem("i2", "A", 0);
    expect(useTierListStore.getState().tiers.A).toEqual(["i2"]);

    useTierListStore.getState().moveItem("i3", "S", 1);
    useTierListStore.getState().reorderInContainer("S", 1, 0);
    expect(useTierListStore.getState().tiers.S).toEqual(["i3", "i1"]);

    useTierListStore.getState().reorderTier("A", ["i2"]);
    expect(useTierListStore.getState().getVotes()).toEqual([
      { sessionItemId: "i3", tierKey: "S", rankInTier: 0 },
      { sessionItemId: "i1", tierKey: "S", rankInTier: 1 },
      { sessionItemId: "i2", tierKey: "A", rankInTier: 0 },
    ]);
  });

  it("adds and removes tiers while preserving removed items", () => {
    useTierListStore.getState().initialize(items, ["S", "A"], { S: ["i1"], A: ["i2"] });

    useTierListStore.getState().addTier("B");
    expect(useTierListStore.getState().tiers.B).toEqual([]);

    useTierListStore.getState().removeTier("A");
    expect(useTierListStore.getState().tiers).toEqual({ S: ["i1"], B: [] });
    expect(useTierListStore.getState().unranked).toContain("i2");
  });
});
