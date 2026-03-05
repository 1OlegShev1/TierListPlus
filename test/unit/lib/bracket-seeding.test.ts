import { seedTiersFromRanking } from "@/lib/bracket-seeding";

const TIERS = [
  { key: "S", label: "S", color: "#f00", sortOrder: 0 },
  { key: "A", label: "A", color: "#f90", sortOrder: 1 },
  { key: "B", label: "B", color: "#ff0", sortOrder: 2 },
  { key: "C", label: "C", color: "#0f0", sortOrder: 3 },
  { key: "D", label: "D", color: "#09f", sortOrder: 4 },
];

describe("seedTiersFromRanking", () => {
  it("uses the middle-heavy distribution for 10 items and 5 tiers", () => {
    const ranked = Array.from({ length: 10 }, (_, i) => `item_${i + 1}`);

    const seeded = seedTiersFromRanking(ranked, TIERS);

    expect(seeded.S).toEqual(["item_1"]);
    expect(seeded.A).toEqual(["item_2", "item_3", "item_4"]);
    expect(seeded.B).toEqual(["item_5", "item_6", "item_7"]);
    expect(seeded.C).toEqual(["item_8", "item_9"]);
    expect(seeded.D).toEqual(["item_10"]);
  });

  it("keeps 20-item seeding concentrated in the middle tiers", () => {
    const ranked = Array.from({ length: 20 }, (_, i) => `item_${i + 1}`);

    const seeded = seedTiersFromRanking(ranked, TIERS);

    expect(seeded.S).toHaveLength(2);
    expect(seeded.A).toHaveLength(5);
    expect(seeded.B).toHaveLength(7);
    expect(seeded.C).toHaveLength(4);
    expect(seeded.D).toHaveLength(2);
  });

  it("keeps 15-item seeding practical for follow-up manual edits", () => {
    const ranked = Array.from({ length: 15 }, (_, i) => `item_${i + 1}`);

    const seeded = seedTiersFromRanking(ranked, TIERS);

    expect(seeded.S).toHaveLength(1);
    expect(seeded.A).toHaveLength(4);
    expect(seeded.B).toHaveLength(5);
    expect(seeded.C).toHaveLength(3);
    expect(seeded.D).toHaveLength(2);
  });

  it("fills top tiers first when items are fewer than tiers", () => {
    const seeded = seedTiersFromRanking(["x", "y", "z"], TIERS);

    expect(seeded.S).toEqual(["x"]);
    expect(seeded.A).toEqual(["y"]);
    expect(seeded.B).toEqual(["z"]);
    expect(seeded.C).toEqual([]);
    expect(seeded.D).toEqual([]);
  });

  it("returns empty buckets when ranking is empty", () => {
    const seeded = seedTiersFromRanking([], TIERS);

    expect(seeded).toEqual({ S: [], A: [], B: [], C: [], D: [] });
  });
});
